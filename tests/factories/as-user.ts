import { Pool } from "@neondatabase/serverless";

import { createPooledDb } from "../../src/db/transaction-retry";
import {
  createWithUserDb,
  type UserIdentity,
  type UserTx,
} from "../../src/db/user-db";

// withUserDb réel (amorçage pg_session_jwt, set_config, vérification d'identité) sur la branche test,
// en rôle app_backend (DATABASE_TEST_AUTHENTICATED_URL). Seule la vérification du jeton est remplacée :
// le « jeton » est directement l'uuid de l'utilisateur. Les transactions sont validées (COMMIT) comme
// en production : le nettoyage passe par deleteCoreFixture.

export type TestUserDb = {
  asUser<T>(
    userId: string,
    fn: (tx: UserTx, identity: UserIdentity) => Promise<T>,
  ): Promise<T>;
  end(): Promise<void>;
};

export function createTestUserDb(backendUrl: string): TestUserDb {
  // Filet : ce withUserDb ne vérifie aucun jeton ; il ne doit jamais tourner hors des tests.
  if (!process.env.VITEST) {
    throw new Error("createTestUserDb est réservé aux tests Vitest.");
  }
  const pool = new Pool({ connectionString: backendUrl, max: 2 });
  const withUserDb = createWithUserDb({
    verify: async (userId) => ({ sub: userId, role: "authenticated" }),
    // Comme src/db/client.ts : connexion prise et rendue par transaction.
    db: createPooledDb(pool),
    // Pas de purge : ces tests ne gèlent aucun pool (nouvelle tentative testée par tests/db/pool-dead-after-freeze).
    evictIdle: async () => undefined,
    poolName: "test",
  });
  return {
    asUser: (userId, fn) => withUserDb(userId, fn),
    end: () => pool.end(),
  };
}
