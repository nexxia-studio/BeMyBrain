import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";

// Données des tests d'isolation, créées avec le rôle propriétaire (DATABASE_TEST_URL).
// Identifiants aléatoires par run : deux runs simultanés ne se marchent pas dessus.

export type CoreFixture = {
  /** suffixe des noms, unique par run */
  run: string;
  workspaceA: string;
  workspaceB: string;
  /** owner de A */
  userA: string;
  /** member de A, locale en dès l'insertion (les autres sont en fr) */
  userA2: string;
  /** owner de B */
  userB: string;
  /** member de A (locale fr) ET de B (locale en), inséré seulement par insertDualMember */
  userAB: string;
  contextA: string;
  contextB: string;
};

/** Pool propriétaire de la branche test (DATABASE_TEST_URL), pour préparer et nettoyer la fixture. */
export function createOwnerPool(ownerUrl: string): Pool {
  return new Pool({ connectionString: ownerUrl, max: 1 });
}

/** Identifiants du run, générés AVANT toute insertion : le nettoyage les connaît même si l'insertion échoue. */
export function newCoreFixture(): CoreFixture {
  return {
    run: randomUUID().slice(0, 8),
    workspaceA: randomUUID(),
    workspaceB: randomUUID(),
    userA: randomUUID(),
    userA2: randomUUID(),
    userB: randomUUID(),
    userAB: randomUUID(),
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
    `insert into workspace_members (workspace_id, user_id, role, locale) values
      ($1, $2, 'owner', 'fr'), ($1, $3, 'member', 'en'), ($4, $5, 'owner', 'fr')`,
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

/**
 * Rattache userAB à A (fr) et à B (en). À part d'insertCoreFixture : les tests d'isolation comptent
 * les membres de chaque workspace et supposent des membres disjoints.
 */
export async function insertDualMember(
  owner: Pool,
  f: CoreFixture,
): Promise<void> {
  await owner.query(
    `insert into workspace_members (workspace_id, user_id, role, locale) values
      ($1, $3, 'member', 'fr'), ($2, $3, 'member', 'en')`,
    [f.workspaceA, f.workspaceB, f.userAB],
  );
}

export type ContextRow = {
  name: string;
  kind: "private" | "pro";
  position: number | null;
};

/** Ajoute des contextes à un workspace de la fixture (supprimés par deleteCoreFixture). */
export async function insertContexts(
  owner: Pool,
  workspaceId: string,
  rows: ContextRow[],
): Promise<void> {
  for (const row of rows) {
    await owner.query(
      "insert into contexts (workspace_id, name, kind, position) values ($1, $2, $3, $4)",
      [workspaceId, row.name, row.kind, row.position],
    );
  }
}
