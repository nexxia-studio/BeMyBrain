// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import { errorTag } from "../../../tests/factories/error-tag";
import {
  deleteShoppingFixture,
  insertShoppingFixture,
  newShoppingFixture,
} from "../../../tests/factories/shopping";

import { addItem } from "./mutations";
import { getAisleOrder, getAisleOverrides, getShoppingList } from "./queries";

// Isolation du module shopping (constitution 5) contre la branche Neon test : withUserDb réel en rôle
// app_backend, un utilisateur avec le workspace d'un autre. Rien n'est lu ni écrit.

// Délai propre aux tests base de ce fichier : un `it` enchaîne plusieurs allers-retours Neon séquentiels
// (la base éphémère de la CI est environ cinq fois plus lente que le local).
vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

const s = newShoppingFixture();

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => errorTag(e),
  );

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertShoppingFixture(owner, f, s);
});

afterAll(async () => {
  try {
    await deleteShoppingFixture(owner, f);
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

async function stateOf(workspace: string) {
  const { rows } = await owner.query<{ rev: string; items: number }>(
    `select l.rev::text as rev,
            (select count(*)::int from shopping_items i where i.list_id = l.id) as items
     from shopping_lists l where l.workspace_id = $1`,
    [workspace],
  );
  return { rev: Number(rows[0]!.rev), items: rows[0]!.items };
}

describe("lectures croisées", () => {
  it("userA ne lit pas la liste du workspace B (liste vide, rien de B)", async () => {
    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceB, tx),
    );

    expect(list).toEqual({ id: null, name: "Courses", rev: 0, aisles: [] });
  });

  it("userA lit sa liste sans aucun article de B", async () => {
    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );

    const labels = list.aisles.flatMap((g) => g.items.map((i) => i.id));
    expect(labels).toContain(s.itemA);
    expect(labels).not.toContain(s.itemB);
  });

  it("userA ne lit ni les corrections ni l'ordre du workspace B", async () => {
    const result = await db.asUser(f.userA, async (tx) => ({
      overrides: await getAisleOverrides(f.workspaceB, tx),
      order: await getAisleOrder(f.workspaceB, tx),
    }));

    expect(result.overrides.size).toBe(0);
    expect(result.order[0]).toBe("produce");
  });

  it("userB ne lit pas les corrections de userA, même sur le workspace A", async () => {
    const overrides = await db.asUser(f.userB, (tx) =>
      getAisleOverrides(f.workspaceA, tx),
    );

    expect(overrides.size).toBe(0);
  });
});

describe("écritures croisées", () => {
  it("userA ne peut pas ajouter un article au workspace B", async () => {
    const before = await stateOf(f.workspaceB);

    const code = await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceB, "intrus", tx)),
    );

    // ensureList insère d'abord la liste de B : la WITH CHECK de shopping_lists_insert refuse (42501),
    // avant tout contrôle de conflit.
    expect(code).toBe("42501");
    expect(await stateOf(f.workspaceB)).toEqual(before);
  });

  it("l'ajout de userA dans son workspace ne touche pas la liste de B", async () => {
    const beforeB = await stateOf(f.workspaceB);

    await db.asUser(f.userA, (tx) => addItem(f.workspaceA, "citron", tx));

    expect(await stateOf(f.workspaceB)).toEqual(beforeB);
  });
});
