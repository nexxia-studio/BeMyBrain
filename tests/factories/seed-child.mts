// Processus enfant de scripts/seed.test.ts (BRAIN-50, tâche 4), lancé par `node --import tsx` : hors Vitest.
// Point d'entrée ESM (.mts) : les .ts du projet y sont chargés en CommonJS par tsx, et un paquet importé ici
// directement en ESM. Un Pool créé par createPool (CommonJS) n'est donc pas une instance du Pool que voit
// le Drizzle ESM : `drizzle({ client: pool }).transaction` ne prend alors aucune connexion à lui, chaque requête
// part seule sur le pool (BEGIN, requêtes et COMMIT sur des connexions qui peuvent différer). withAdminTx
// (createPooledDb) donne une connexion à Drizzle : vraie transaction quel que soit le chargement.
//
// Variables : SEED_CHILD=1, DATABASE_URL et DATABASE_AUTHENTICATED_URL de la branche test, NEON_PRODUCTION_HOST
// (ou plateforme de confiance), posées par le test parent.
// Arguments : <mode> [uuid du propriétaire].
// - `rollback` : seedWorkspace via withAdminTx, puis erreur levée dans la même transaction après les insertions ;
// - `concurrent` : deux seedWorkspace simultanés via withAdminTx ;
// - `lock` : seedWorkspace via withAdminTx ; juste avant le COMMIT, puis après, une autre connexion essaie de prendre
//   le verrou du seed (pg_try_advisory_lock, même clé) ;
// - `backends` : deux lectures simultanées de pg_backend_pid() dans une transaction withAdminTx ;
// - `naive-backends` : témoin, la même chose avec `drizzle({ client: createPool(…) }).transaction` (le piège).
// Une ligne JSON sur stdout, jamais d'URL ni de message du pilote.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import { endAdminPool, withAdminTx, type AdminTx } from "../../src/db/admin";
import { getMigrationEnv } from "../../src/db/migration-env";
import { createPool, type AppPool } from "../../src/db/pool";
import { seedWorkspace, type SeedTransaction } from "../../scripts/seed";
import { enforceChildTarget } from "./child-guard";

// Avant toute connexion : marqueur du test parent exigé, production refusée (sortie code 2).
enforceChildTarget({ marker: "SEED_CHILD", urlVariable: "DATABASE_URL" });

const [mode, ownerUserId = ""] = process.argv.slice(2);

class WantedRollback extends Error {}

/** Lance `fn` dans une transaction, puis lève une erreur : une vraie transaction annule tout. */
function failingAfter(run: SeedTransaction): SeedTransaction {
  return (fn) =>
    run(async (tx) => {
      await fn(tx);
      throw new WantedRollback("annulation voulue");
    });
}

/** Backends Postgres distincts qui servent deux lectures simultanées d'une même transaction. */
async function distinctBackends(run: SeedTransaction): Promise<number> {
  const pids = await run((tx) =>
    Promise.all(
      [1, 2].map(async () => {
        const { rows } = await tx.execute<{ pid: number }>(
          sql`select pg_backend_pid() as pid, pg_sleep(0.2)`,
        );
        return rows[0]?.pid;
      }),
    ),
  );
  return new Set(pids).size;
}

/** Une autre connexion peut-elle prendre le verrou du seed pour ce propriétaire ? Relâché aussitôt si pris. */
async function lockIsFree(probe: AppPool): Promise<boolean> {
  const client = await probe.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>(
      "select pg_try_advisory_lock(hashtextextended($1, 0)) as ok",
      [ownerUserId],
    );
    const free = rows[0]?.ok === true;
    if (free)
      await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [
        ownerUserId,
      ]);
    return free;
  } finally {
    client.release();
  }
}

async function main(): Promise<Record<string, unknown>> {
  if (mode === "naive-backends") {
    const pool = createPool(getMigrationEnv().DATABASE_URL, "témoin");
    try {
      const db = drizzle({ client: pool });
      const naive: SeedTransaction = (fn) =>
        db.transaction((tx) => fn(tx as unknown as AdminTx));
      return { backends: await distinctBackends(naive) };
    } finally {
      await pool.end();
    }
  }
  try {
    if (mode === "lock") {
      const probe = createPool(getMigrationEnv().DATABASE_URL, "sonde");
      try {
        let duringTransaction: boolean | undefined;
        // fn de seedWorkspace terminée (verrou pris en tête), COMMIT pas encore envoyé.
        const probing: SeedTransaction = (fn) =>
          withAdminTx(async (tx) => {
            const result = await fn(tx);
            duringTransaction = await lockIsFree(probe);
            return result;
          });
        const { created } = await seedWorkspace(probing, { ownerUserId });
        return {
          created,
          duringTransaction,
          afterCommit: await lockIsFree(probe),
        };
      } finally {
        await probe.end();
      }
    }
    if (mode === "backends") {
      return { backends: await distinctBackends(withAdminTx) };
    }
    if (mode === "rollback") {
      const outcome = await seedWorkspace(failingAfter(withAdminTx), {
        ownerUserId,
      }).then(
        () => "résolue",
        (error: unknown) =>
          error instanceof WantedRollback ? "annulée" : "autre erreur",
      );
      return { outcome };
    }
    if (mode === "concurrent") {
      const results = await Promise.all([
        seedWorkspace(withAdminTx, { ownerUserId }),
        seedWorkspace(withAdminTx, { ownerUserId }),
      ]);
      return { created: results.map((result) => result.created) };
    }
    throw new Error("seed-child : mode inconnu.");
  } finally {
    await endAdminPool();
  }
}

main().then(
  (result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  },
  (error: unknown) => {
    process.stdout.write(
      `${JSON.stringify({ error: error instanceof Error ? error.name : "inconnue" })}\n`,
    );
    process.exitCode = 1;
  },
);
