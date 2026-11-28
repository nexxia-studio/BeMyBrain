import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";

import type { CoreFixture } from "./core";

// Listes de courses des tests d'isolation, dans les deux workspaces d'une CoreFixture. Insérées avec le
// rôle propriétaire (DATABASE_TEST_URL), qui contourne la RLS : user_id est donc fourni explicitement
// (sans claims, app.current_user_id() est NULL). Supprimées par deleteShoppingFixture, à appeler AVANT
// deleteCoreFixture (clés étrangères vers workspaces).

export type ShoppingFixture = {
  listA: string;
  listB: string;
  /** article de A (rayon « produce ») */
  itemA: string;
  /** article de A, déjà coché */
  checkedItemA: string;
  itemB: string;
  /** correction de userA dans A */
  overrideA: string;
  /** correction de userB dans B */
  overrideB: string;
};

/** Identifiants générés avant toute insertion, comme newCoreFixture. */
export function newShoppingFixture(): ShoppingFixture {
  return {
    listA: randomUUID(),
    listB: randomUUID(),
    itemA: randomUUID(),
    checkedItemA: randomUUID(),
    itemB: randomUUID(),
    overrideA: randomUUID(),
    overrideB: randomUUID(),
  };
}

export async function insertShoppingFixture(
  owner: Pool,
  core: CoreFixture,
  s: ShoppingFixture,
): Promise<void> {
  // rev et channel_id sont laissés à leurs défauts : un test les relit.
  await owner.query(
    `insert into shopping_lists (id, workspace_id, name) values ($1, $2, 'Courses'), ($3, $4, 'Courses')`,
    [s.listA, core.workspaceA, s.listB, core.workspaceB],
  );
  await owner.query(
    `insert into shopping_items (id, workspace_id, list_id, label, aisle_key, checked_at) values
       ($1, $2, $3, 'pommes', 'produce', null),
       ($4, $2, $3, 'lait', 'dairyEggs', now()),
       ($5, $6, $7, 'farine', 'pantrySavory', null)`,
    [
      s.itemA,
      core.workspaceA,
      s.listA,
      s.checkedItemA,
      s.itemB,
      core.workspaceB,
      s.listB,
    ],
  );
  await owner.query(
    `insert into shopping_aisle_overrides (id, workspace_id, user_id, keyword, aisle_key) values
       ($1, $2, $3, 'bidule', 'household'), ($4, $5, $6, 'bidule', 'drinks')`,
    [
      s.overrideA,
      core.workspaceA,
      core.userA,
      s.overrideB,
      core.workspaceB,
      core.userB,
    ],
  );
  await owner.query(
    `insert into shopping_aisle_order (workspace_id, user_id, aisle_keys) values
       ($1, $2, array['frozen', 'produce']), ($3, $4, array['drinks'])`,
    [core.workspaceA, core.userA, core.workspaceB, core.userB],
  );
}

export async function deleteShoppingFixture(
  owner: Pool,
  core: CoreFixture,
): Promise<void> {
  const ids = [core.workspaceA, core.workspaceB];
  for (const table of [
    "shopping_aisle_order",
    "shopping_aisle_overrides",
    "shopping_items",
    "shopping_lists",
  ]) {
    await owner.query(`delete from ${table} where workspace_id = any($1)`, [
      ids,
    ]);
  }
}
