import type { NeonDatabase } from "drizzle-orm/neon-serverless";

import { getMigrationEnv } from "./migration-env";
import { createPool, type AppPool } from "./pool";
import { createPooledDb, runTransaction } from "./transaction-retry";

// Rôle propriétaire : contourne la RLS. Réservé aux scripts (seed) et aux tests.
// Import interdit depuis src/app, src/components et src/modules (eslint.config.mjs).

export type AdminTx = Parameters<Parameters<NeonDatabase["transaction"]>[0]>[0];

const POOL_NAME = "propriétaire";

// Pool ouvert au premier appel : importer ce module ne lit aucune variable et n'ouvre rien.
let pool: AppPool | undefined;

function getPool(): AppPool {
  pool ??= createPool(getMigrationEnv().DATABASE_URL, POOL_NAME);
  return pool;
}

/**
 * Exécute `fn` dans une transaction du rôle propriétaire, par le même mécanisme que withUserDb (BRAIN-50) :
 * connexion prise et rendue par transaction (createPooledDb, une vraie transaction même sous tsx), une seule
 * nouvelle tentative si la connexion tombe avant `fn`, jamais après.
 */
export function withAdminTx<T>(fn: (tx: AdminTx) => Promise<T>): Promise<T> {
  const current = getPool();
  return runTransaction(
    {
      db: createPooledDb(current),
      evictIdle: current.evictIdle,
      poolName: POOL_NAME,
    },
    // Aucune identité à poser : le rôle propriétaire ne passe pas par la RLS.
    async () => undefined,
    fn,
  );
}

/** Ferme le pool propriétaire (fin du script) ; un appel suivant à withAdminTx en rouvre un. */
export async function endAdminPool(): Promise<void> {
  const current = pool;
  pool = undefined;
  await current?.end();
}
