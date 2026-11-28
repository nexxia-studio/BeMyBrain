// @vitest-environment node
import { sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import { errorTag } from "../../../tests/factories/error-tag";
import { waitForLockWait } from "../../../tests/factories/lock-wait";
import { deleteShoppingFixture } from "../../../tests/factories/shopping";

import { AISLE_KEYS } from "./aisles";
import {
  MAX_AISLE_OVERRIDES,
  addItem,
  moveItemToAisle,
  setAisleOrder,
} from "./mutations";
import { getAisleOrder, getAisleOverrides } from "./queries";

// Correction mémorisée et ordre des rayons contre la branche Neon test (withUserDb réel, rôle app_backend).
// userA et userA2 sont deux membres du même workspace A : leurs corrections et leur ordre sont distincts.

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

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? errorTag(e),
  );

const addAs = (user: string, label: string) =>
  db.asUser(user, (tx) => addItem(f.workspaceA, label, tx));
const moveAs = (user: string, itemId: string, aisle: string) =>
  db.asUser(user, (tx) => moveItemToAisle(f.workspaceA, itemId, aisle, tx));

async function itemRow(id: string) {
  const { rows } = await owner.query<{ aisle_key: string; pinned: boolean }>(
    "select aisle_key, aisle_pinned as pinned from shopping_items where id = $1",
    [id],
  );
  return rows[0]!;
}

async function rev(): Promise<number> {
  const { rows } = await owner.query<{ rev: string }>(
    "select rev::text as rev from shopping_lists where workspace_id = $1",
    [f.workspaceA],
  );
  return Number(rows[0]!.rev);
}

beforeAll(async () => {
  await insertCoreFixture(owner, f);
});

beforeEach(async () => {
  for (const table of [
    "shopping_aisle_order",
    "shopping_aisle_overrides",
    "shopping_items",
  ]) {
    await owner.query(`delete from ${table} where workspace_id = $1`, [
      f.workspaceA,
    ]);
  }
});

afterAll(async () => {
  try {
    await deleteShoppingFixture(owner, f);
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

describe("moveItemToAisle : correction mémorisée", () => {
  it("épingle l'article dans le nouveau rayon et incrémente rev de 1", async () => {
    const item = await addAs(f.userA, "bidule");
    const before = await rev();

    const moved = await moveAs(f.userA, item.id, "household");

    expect(moved).toEqual({
      id: item.id,
      aisleKey: "household",
      rev: before + 1,
    });
    expect(await itemRow(item.id)).toEqual({
      aisle_key: "household",
      pinned: true,
    });
    expect(await rev()).toBe(before + 1);
  });

  it("un article déplacé revient dans ce rayon à l'ajout suivant du même libellé, pour cet utilisateur seulement", async () => {
    const item = await addAs(f.userA, "bidule");
    await moveAs(f.userA, item.id, "household");

    const again = await addAs(f.userA, "Bidule");
    const other = await addAs(f.userA2, "bidule");

    expect(again.aisleKey).toBe("household");
    expect(other.aisleKey).toBe("other");
  });

  it("mémorise le libellé normalisé complet, sans la quantité, avec user_id posé par la base", async () => {
    const item = await addAs(f.userA, "2 Bidules truc");

    await moveAs(f.userA, item.id, "drinks");

    const { rows } = await owner.query<{ keyword: string; user_id: string }>(
      "select keyword, user_id from shopping_aisle_overrides where workspace_id = $1",
      [f.workspaceA],
    );
    expect(rows).toEqual([{ keyword: "bidules truc", user_id: f.userA }]);
    const own = await db.asUser(f.userA, (tx) =>
      getAisleOverrides(f.workspaceA, tx),
    );
    expect(own.get("bidules truc")).toBe("drinks");
    const theirs = await db.asUser(f.userA2, (tx) =>
      getAisleOverrides(f.workspaceA, tx),
    );
    expect(theirs.size).toBe(0);
  });

  it("déplacer une seconde fois le même libellé remplace la correction (une seule ligne)", async () => {
    const first = await addAs(f.userA, "bidule");
    const second = await addAs(f.userA, "bidule");

    await moveAs(f.userA, first.id, "household");
    await moveAs(f.userA, second.id, "frozen");

    const { rows } = await owner.query(
      "select aisle_key from shopping_aisle_overrides where workspace_id = $1",
      [f.workspaceA],
    );
    expect(rows).toEqual([{ aisle_key: "frozen" }]);
    expect((await addAs(f.userA, "bidule")).aisleKey).toBe("frozen");
  });

  it("le déplacement de userA2 ne touche pas la correction de userA", async () => {
    const item = await addAs(f.userA, "bidule");
    await moveAs(f.userA, item.id, "household");
    const mine = await addAs(f.userA2, "bidule");

    await moveAs(f.userA2, mine.id, "drinks");

    expect((await addAs(f.userA, "bidule")).aisleKey).toBe("household");
    expect((await addAs(f.userA2, "bidule")).aisleKey).toBe("drinks");
  });

  it("un libellé sans forme normalisée déplace l'article sans rien mémoriser", async () => {
    const item = await addAs(f.userA, "?");

    await moveAs(f.userA, item.id, "drinks");

    expect(await itemRow(item.id)).toEqual({
      aisle_key: "drinks",
      pinned: true,
    });
    const { rows } = await owner.query(
      "select 1 from shopping_aisle_overrides where workspace_id = $1",
      [f.workspaceA],
    );
    expect(rows).toHaveLength(0);
  });

  it("refuse un article inconnu, sans écrire", async () => {
    await addAs(f.userA, "bidule");
    const before = await rev();

    const code = await codeOf(
      moveAs(f.userA, "00000000-0000-4000-8000-0000000000ff", "drinks"),
    );

    expect(code).toBe("invalid_params");
    expect(await rev()).toBe(before);
  });

  it("refuse un rayon inconnu, sans écrire", async () => {
    const item = await addAs(f.userA, "bidule");

    const code = await codeOf(moveAs(f.userA, item.id, "inconnu"));

    expect(code).toBe("invalid_params");
    expect((await itemRow(item.id)).pinned).toBe(false);
  });
});

describe("moveItemToAisle : plafond de corrections par utilisateur", () => {
  async function fillOverrides(user: string, count: number) {
    await owner.query(
      `insert into shopping_aisle_overrides (workspace_id, user_id, keyword, aisle_key)
       select $1, $2, 'mot' || g, 'other' from generate_series(1, $3::int) g`,
      [f.workspaceA, user, count],
    );
  }

  it("au plafond, l'article bouge mais la nouvelle correction n'est pas mémorisée", async () => {
    const item = await addAs(f.userA, "bidule");
    await fillOverrides(f.userA, MAX_AISLE_OVERRIDES);
    const before = await rev();

    const code = await codeOf(moveAs(f.userA, item.id, "drinks"));

    expect(code).toBe("ok");
    expect(await itemRow(item.id)).toEqual({
      aisle_key: "drinks",
      pinned: true,
    });
    expect(await rev()).toBe(before + 1);
    const { rows } = await owner.query(
      `select 1 from shopping_aisle_overrides where user_id = $1 and keyword = 'bidule'`,
      [f.userA],
    );
    expect(rows).toHaveLength(0);
  });

  it("au plafond, modifier une correction existante reste permis", async () => {
    const item = await addAs(f.userA, "bidule");
    await moveAs(f.userA, item.id, "household");
    await fillOverrides(f.userA, MAX_AISLE_OVERRIDES - 1);

    const code = await codeOf(moveAs(f.userA, item.id, "drinks"));

    expect(code).toBe("ok");
  });

  it("le plafond d'un utilisateur ne bloque pas l'autre membre", async () => {
    await fillOverrides(f.userA, MAX_AISLE_OVERRIDES);
    const item = await addAs(f.userA2, "bidule");

    const code = await codeOf(moveAs(f.userA2, item.id, "drinks"));

    expect(code).toBe("ok");
  });

  it("deux corrections simultanées à 499 : les deux réussissent, une seule est mémorisée (verrou de la liste)", async () => {
    const one = await addAs(f.userA, "premier");
    const two = await addAs(f.userA, "second");
    await fillOverrides(f.userA, MAX_AISLE_OVERRIDES - 1);

    let commitFirst = () => {};
    const gate = new Promise<void>((resolve) => (commitFirst = resolve));
    let firstWritten = () => {};
    const written = new Promise<void>((resolve) => (firstWritten = resolve));
    const first = codeOf(
      db.asUser(f.userA, async (tx) => {
        await moveItemToAisle(f.workspaceA, one.id, "drinks", tx);
        firstWritten();
        await gate;
      }),
    );
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));
    let blocked = false;
    let second: Promise<string> | null = null;
    try {
      await Promise.race([written, first]);
      second = codeOf(
        db.asUser(f.userA, async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await moveItemToAisle(f.workspaceA, two.id, "frozen", tx);
        }),
      );
      void second.then(() => setPid(-1));
      blocked = await waitForLockWait(owner, await pid, "advisory");
    } finally {
      commitFirst();
    }

    expect(blocked).toBe(true);
    // Au plafond, le déplacement n'échoue jamais : les deux articles bougent, une seule correction s'ajoute.
    expect([await first, await second!]).toEqual(["ok", "ok"]);
    const { rows } = await owner.query<{ n: number }>(
      "select count(*)::int as n from shopping_aisle_overrides where workspace_id = $1 and user_id = $2",
      [f.workspaceA, f.userA],
    );
    expect(rows[0]!.n).toBe(MAX_AISLE_OVERRIDES);
  });
});

describe("setAisleOrder : ordre des rayons par utilisateur", () => {
  const reversed = [...AISLE_KEYS].reverse();

  it("mémorise une permutation et la relit", async () => {
    await db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, reversed, tx));

    const order = await db.asUser(f.userA, (tx) =>
      getAisleOrder(f.workspaceA, tx),
    );
    expect(order).toEqual(reversed);
  });

  it("un second enregistrement remplace le premier (une seule ligne)", async () => {
    await db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, reversed, tx));
    await db.asUser(f.userA, (tx) =>
      setAisleOrder(f.workspaceA, [...AISLE_KEYS], tx),
    );

    const { rows } = await owner.query<{ user_id: string }>(
      "select user_id from shopping_aisle_order where workspace_id = $1",
      [f.workspaceA],
    );
    expect(rows).toEqual([{ user_id: f.userA }]);
    expect(
      await db.asUser(f.userA, (tx) => getAisleOrder(f.workspaceA, tx)),
    ).toEqual([...AISLE_KEYS]);
  });

  it("l'ordre de l'un n'est pas lisible ni modifiable par l'autre membre", async () => {
    await db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, reversed, tx));

    const seenByOther = await db.asUser(f.userA2, (tx) =>
      getAisleOrder(f.workspaceA, tx),
    );
    await db.asUser(f.userA2, (tx) =>
      setAisleOrder(f.workspaceA, [...AISLE_KEYS], tx),
    );

    expect(seenByOther).toEqual([...AISLE_KEYS]);
    expect(
      await db.asUser(f.userA, (tx) => getAisleOrder(f.workspaceA, tx)),
    ).toEqual(reversed);
    const { rows } = await owner.query<{ user_id: string }>(
      "select user_id from shopping_aisle_order where workspace_id = $1 order by user_id",
      [f.workspaceA],
    );
    expect(rows.map((r) => r.user_id).sort()).toEqual(
      [f.userA, f.userA2].sort(),
    );
  });

  it("refuse un ordre qui n'est pas une permutation, sans rien écrire", async () => {
    const [first, ...rest] = [...AISLE_KEYS];
    const bad = [[], rest, [first, first, ...rest.slice(1)], ["x", ...rest]];

    const codes = [];
    for (const order of bad) {
      codes.push(
        await codeOf(
          db.asUser(f.userA, (tx) => setAisleOrder(f.workspaceA, order, tx)),
        ),
      );
    }

    expect(codes).toEqual(Array(bad.length).fill("invalid_params"));
    const { rows } = await owner.query(
      "select 1 from shopping_aisle_order where workspace_id = $1",
      [f.workspaceA],
    );
    expect(rows).toHaveLength(0);
  });
});
