import type { PoolClient } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import { isConnectionLost } from "./connection-lost";

// BRAIN-50, solution C (spec, « Règles ») : une transaction n'est rejouée qu'une fois, et seulement si la
// connexion tombe AVANT la fonction métier : prise de connexion, BEGIN, mise en place (`setup`). Dès que `fn` a
// commencé (même une lecture), l'erreur remonte telle quelle : une écriture n'est jamais rejouée.
// Partagé par withUserDb (user-db.ts) et la transaction propriétaire (admin.ts).

/** Plafond d'attente de la purge du pool avant la nouvelle tentative. */
export const EVICT_TIMEOUT_MS = 500;

/** Ce que runTransaction attend d'une base Drizzle : ouvrir une transaction. */
export type TransactionDb<Tx> = {
  transaction<T>(callback: (tx: Tx) => Promise<T>): Promise<T>;
};

export type RetryDeps<Tx> = {
  db: TransactionDb<Tx>;
  /** Retire les connexions au repos du pool (AppPool.evictIdle). */
  evictIdle: () => Promise<void>;
  /** Rôle du pool, seul détail écrit dans la trace. */
  poolName: string;
};

/** Étape où la connexion est tombée : prise de connexion et BEGIN, puis mise en place (identité). */
type Stage = "connexion" | "identité" | "travail";

/** Purge bornée : ni son rejet ni son blocage n'empêchent la nouvelle tentative ou ne masquent l'erreur. */
async function evictBounded(evictIdle: () => Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, EVICT_TIMEOUT_MS);
  });
  try {
    await Promise.race([evictIdle().catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runTransaction<Tx, T>(
  deps: RetryDeps<Tx>,
  setup: (tx: Tx) => Promise<void>,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    // Objet plutôt que variable : TypeScript ne voit pas l'affectation faite dans le rappel.
    const progress: { stage: Stage } = { stage: "connexion" };
    try {
      return await deps.db.transaction(async (tx) => {
        progress.stage = "identité";
        await setup(tx);
        // Frontière : drapeau posé juste avant fn ; à partir d'ici, plus aucune nouvelle tentative.
        progress.stage = "travail";
        return fn(tx);
      });
    } catch (error) {
      // Classement sur l'erreur brute, avant tout masquage (DatabaseError) par l'appelant.
      const { stage } = progress;
      if (stage === "travail" || attempt > 1 || !isConnectionLost(error))
        throw error;
      // Trace sans donnée : ni identifiant, ni requête, ni message ou code du pilote.
      console.warn(
        `Nouvelle tentative sur le pool ${deps.poolName} : connexion perdue (étape ${stage}).`,
      );
      // La connexion morte est déjà rendue et retirée (createPooledDb) : la purge ne peut pas l'attendre.
      await evictBounded(deps.evictIdle);
    }
  }
}

/** Pool réduit à ce dont createPooledDb a besoin. */
type ConnectionSource = { connect(): Promise<PoolClient> };

/**
 * Base Drizzle qui prend elle-même sa connexion pour chaque transaction et la rend toujours.
 * drizzle-orm 0.45 (neon-serverless, NeonSession.transaction) n'exécute le BEGIN qu'en dehors de son
 * try/finally : un BEGIN en échec ne rend jamais la connexion, qui reste empruntée et occupe une place du pool
 * pour toujours (au réveil d'une veille, chaque lecture en échec en garderait une). Et une connexion rendue sans
 * erreur retourne au repos si le pilote ne l'a pas encore marquée non requêtable. Ici : connexion perdue → rendue
 * avec `release(true)`, pg-pool la retire et la ferme ; sinon (y compris erreur SQL, connexion saine) rendue
 * normalement.
 */
export function createPooledDb(
  pool: ConnectionSource,
): TransactionDb<Parameters<Parameters<NeonDatabase["transaction"]>[0]>[0]> {
  return {
    async transaction(callback) {
      const client = await pool.connect();
      let lostConnection = false;
      try {
        return await drizzle({ client }).transaction(callback);
      } catch (error) {
        lostConnection = isConnectionLost(error);
        throw error;
      } finally {
        client.release(lostConnection ? true : undefined);
      }
    },
  };
}
