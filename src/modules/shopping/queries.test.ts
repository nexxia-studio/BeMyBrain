// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import {
  deleteShoppingFixture,
  insertShoppingFixture,
  newShoppingFixture,
} from "../../../tests/factories/shopping";
import { AISLE_KEYS, DEFAULT_AISLE_ORDER } from "./aisles";
import { getAisleOrder, getAisleOverrides, getShoppingList } from "./queries";

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

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertShoppingFixture(owner, f, s);
  // « glace » (Surgelés) et « poires » (cochée plus tôt que « lait », même rayon que « pommes »).
  await owner.query(
    `insert into shopping_items (workspace_id, list_id, label, aisle_key, checked_at) values
       ($1, $2, 'glace', 'frozen', null),
       ($1, $2, 'poires', 'produce', now() - interval '1 hour')`,
    [f.workspaceA, s.listA],
  );
});

afterAll(async () => {
  try {
    await deleteShoppingFixture(owner, f);
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

describe("getShoppingList", () => {
  it("range les articles par rayon dans l'ordre de l'utilisateur, rayons vides omis", async () => {
    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );

    expect(list.aisles.map((g) => g.aisleKey)).toEqual([
      "frozen",
      "produce",
      "dairyEggs",
    ]);
    expect(list.id).toBe(s.listA);
  });

  it("met les cochés en bas de leur rayon, triés par date de cochage", async () => {
    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );

    const produce = list.aisles.find((g) => g.aisleKey === "produce")!;
    expect(produce.items.map((i) => i.label)).toEqual(["pommes", "poires"]);
    expect(produce.items[1]!.checkedAt).toBeInstanceOf(Date);
  });

  it("applique l'ordre par défaut à un autre membre de l'espace", async () => {
    const list = await db.asUser(f.userA2, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );

    expect(list.aisles.map((g) => g.aisleKey)).toEqual([
      "produce",
      "dairyEggs",
      "frozen",
    ]);
  });

  it("rend la version de la liste", async () => {
    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );

    expect(list.rev).toBe(0);
    expect(list.name).toBe("Courses");
    expect([...list.order].sort()).toEqual([...AISLE_KEYS].sort());
  });

  it("n'écrit rien : un workspace sans liste rend une liste vide sans id", async () => {
    await deleteShoppingFixture(owner, f);

    const list = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );
    const { rows } = await owner.query(
      "select 1 from shopping_lists where workspace_id = $1",
      [f.workspaceA],
    );

    expect(list).toEqual({
      id: null,
      name: "Courses",
      rev: 0,
      order: [...DEFAULT_AISLE_ORDER],
      aisles: [],
    });
    expect(rows).toHaveLength(0);
    await insertShoppingFixture(owner, f, s);
  });

  it("refuse un workspaceId qui n'est pas un uuid", async () => {
    const tag = await db
      .asUser(f.userA, (tx) => getShoppingList("pas-un-uuid", tx))
      .catch((e: unknown) => (e as { code?: string }).code);

    expect(tag).toBe("invalid_params");
  });
});

describe("getAisleOverrides et getAisleOrder", () => {
  it("rendent les corrections et l'ordre de l'utilisateur seulement", async () => {
    const [a, a2] = await Promise.all([
      db.asUser(f.userA, async (tx) => ({
        overrides: await getAisleOverrides(f.workspaceA, tx),
        order: await getAisleOrder(f.workspaceA, tx),
      })),
      db.asUser(f.userA2, async (tx) => ({
        overrides: await getAisleOverrides(f.workspaceA, tx),
        order: await getAisleOrder(f.workspaceA, tx),
      })),
    ]);

    expect(a.overrides.get("bidule")).toBe("household");
    expect(a.order.slice(0, 2)).toEqual(["frozen", "produce"]);
    expect(a2.overrides.size).toBe(0);
    expect(a2.order[0]).toBe("produce");
  });
});
