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

import {
  addItem,
  checkItem,
  clearChecked,
  moveItemToAisle,
  removeItem,
  renameItem,
  setAisleOrder,
  uncheckItem,
} from "./mutations";
import { AISLE_KEYS } from "./aisles";
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

describe("écritures croisées sur les articles", () => {
  it("userA ne coche, ne décoche, ne renomme ni ne supprime l'article de B, via B ou via A", async () => {
    const before = await stateOf(f.workspaceB);
    const row = async () =>
      (
        await owner.query(
          "select label, checked_at from shopping_items where id = $1",
          [s.itemB],
        )
      ).rows[0];
    const itemBefore = await row();

    const codes = [
      // workspace de B : la liste de B est invisible pour userA
      await codeOf(
        db.asUser(f.userA, (tx) => checkItem(f.workspaceB, s.itemB, tx)),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) => uncheckItem(f.workspaceB, s.itemB, tx)),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) =>
          renameItem(f.workspaceB, s.itemB, "pirate", tx),
        ),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) => removeItem(f.workspaceB, s.itemB, tx)),
      ),
      await codeOf(db.asUser(f.userA, (tx) => clearChecked(f.workspaceB, tx))),
      // workspace de A, id de l'article de B
      await codeOf(
        db.asUser(f.userA, (tx) => checkItem(f.workspaceA, s.itemB, tx)),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) => uncheckItem(f.workspaceA, s.itemB, tx)),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) =>
          renameItem(f.workspaceA, s.itemB, "pirate", tx),
        ),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) => removeItem(f.workspaceA, s.itemB, tx)),
      ),
    ];

    // clearChecked via B ne vise aucune ligne de A : refus de liste (invalid_params) comme les autres.
    expect(codes).toEqual(Array(codes.length).fill("invalid_params"));
    expect(codes).toHaveLength(9);
    expect(await stateOf(f.workspaceB)).toEqual(before);
    expect(await row()).toEqual(itemBefore);
  });

  it("vider les cochés de A ne supprime rien dans B", async () => {
    await owner.query(
      "update shopping_items set checked_at = now() where id = $1",
      [s.itemB],
    );
    const before = await stateOf(f.workspaceB);

    await db.asUser(f.userA, (tx) => clearChecked(f.workspaceA, tx));

    expect(await stateOf(f.workspaceB)).toEqual(before);
    const { rows } = await owner.query(
      "select 1 from shopping_items where id = $1",
      [s.itemB],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("écritures croisées sur les rayons (tâche 8)", () => {
  const order = [...AISLE_KEYS].reverse();
  const snapshot = async () => ({
    overrides: (
      await owner.query(
        "select workspace_id, user_id, keyword, aisle_key from shopping_aisle_overrides order by id",
      )
    ).rows,
    orders: (
      await owner.query(
        "select workspace_id, user_id, aisle_keys from shopping_aisle_order order by id",
      )
    ).rows,
    item: (
      await owner.query(
        "select aisle_key, aisle_pinned from shopping_items where id = $1",
        [s.itemB],
      )
    ).rows,
  });

  it("userA ne déplace pas l'article de B, via B ou via A", async () => {
    const before = await snapshot();

    const codes = [
      await codeOf(
        db.asUser(f.userA, (tx) =>
          moveItemToAisle(f.workspaceB, s.itemB, "drinks", tx),
        ),
      ),
      await codeOf(
        db.asUser(f.userA, (tx) =>
          moveItemToAisle(f.workspaceA, s.itemB, "drinks", tx),
        ),
      ),
    ];

    expect(codes).toEqual(["invalid_params", "invalid_params"]);
    expect(await snapshot()).toEqual(before);
  });

  it("userA n'enregistre pas d'ordre dans le workspace B (42501), rien ne change", async () => {
    const before = await snapshot();

    const code = await codeOf(
      db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceB, order, tx)),
    );

    expect(code).toBe("42501");
    expect(await snapshot()).toEqual(before);
  });

  it("userA enregistre son ordre chez A sans toucher l'ordre de userB chez B", async () => {
    const before = (await snapshot()).orders.filter(
      (r) => r.workspace_id === f.workspaceB,
    );

    await db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, order, tx));

    const after = (await snapshot()).orders.filter(
      (r) => r.workspace_id === f.workspaceB,
    );
    expect(after).toEqual(before);
    expect(
      await db.asUser(f.userA, (tx) => getAisleOrder(f.workspaceA, tx)),
    ).toEqual(order);
  });

  it("userA2, membre de A, ne lit ni ne modifie l'ordre et les corrections de userA", async () => {
    await db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, order, tx));
    const before = await snapshot();

    const seen = await db.asUser(f.userA2, async (tx) => ({
      order: await getAisleOrder(f.workspaceA, tx),
      overrides: await getAisleOverrides(f.workspaceA, tx),
    }));
    // sa propre ligne s'ajoute, celle de userA reste intacte
    await db.asUser(f.userA2, (tx) =>
      setAisleOrder(f.workspaceA, [...AISLE_KEYS], tx),
    );

    expect(seen.order).toEqual([...AISLE_KEYS]);
    expect(seen.overrides.size).toBe(0);
    const mine = (await snapshot()).orders.filter(
      (r) => r.workspace_id === f.workspaceA && r.user_id === f.userA,
    );
    expect(mine).toEqual(
      before.orders.filter(
        (r) => r.workspace_id === f.workspaceA && r.user_id === f.userA,
      ),
    );
  });
});
