import { randomUUID } from "node:crypto";

import type { Pool } from "@neondatabase/serverless";

// Données des tests d'isolation, créées avec le rôle propriétaire (DATABASE_TEST_URL).
// Identifiants aléatoires par run : deux runs simultanés ne se marchent pas dessus.

export type CoreFixture = {
  /** suffixe des noms, unique par run */
  run: string;
  workspaceA: string;
  workspaceB: string;
  /** owner de A */
  userA: string;
  /** member de A */
  userA2: string;
  /** owner de B */
  userB: string;
  contextA: string;
  contextB: string;
};

/** Identifiants du run, générés AVANT toute insertion : le nettoyage les connaît même si l'insertion échoue. */
export function newCoreFixture(): CoreFixture {
  return {
    run: randomUUID().slice(0, 8),
    workspaceA: randomUUID(),
    workspaceB: randomUUID(),
    userA: randomUUID(),
    userA2: randomUUID(),
    userB: randomUUID(),
    contextA: randomUUID(),
    contextB: randomUUID(),
  };
}

export async function insertCoreFixture(
  owner: Pool,
  f: CoreFixture,
): Promise<void> {
  const { run } = f;
  await owner.query(
    "insert into workspaces (id, name) values ($1, $2), ($3, $4)",
    [f.workspaceA, `test-A-${run}`, f.workspaceB, `test-B-${run}`],
  );
  await owner.query(
    `insert into workspace_members (workspace_id, user_id, role) values
      ($1, $2, 'owner'), ($1, $3, 'member'), ($4, $5, 'owner')`,
    [f.workspaceA, f.userA, f.userA2, f.workspaceB, f.userB],
  );
  await owner.query(
    `insert into contexts (id, workspace_id, name, kind, position) values
      ($1, $2, $3, 'private', 0), ($4, $5, $6, 'pro', 0)`,
    [
      f.contextA,
      f.workspaceA,
      `ctx-A-${run}`,
      f.contextB,
      f.workspaceB,
      `ctx-B-${run}`,
    ],
  );
}

/**
 * Supprime par identifiants tout ce que la fixture a pu créer (même partiellement),
 * y compris ce que les tests ont ajouté dans ses workspaces.
 */
export async function deleteCoreFixture(
  owner: Pool,
  f: CoreFixture,
): Promise<void> {
  const ids = [f.workspaceA, f.workspaceB];
  await owner.query("delete from contexts where workspace_id = any($1)", [ids]);
  await owner.query(
    "delete from workspace_members where workspace_id = any($1)",
    [ids],
  );
  await owner.query("delete from workspaces where id = any($1)", [ids]);
}
