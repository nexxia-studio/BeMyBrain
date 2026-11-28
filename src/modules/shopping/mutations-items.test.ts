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
import { waitForLockWait } from "../../../tests/factories/lock-wait";
import { deleteShoppingFixture } from "../../../tests/factories/shopping";

import {
  addItem,
  checkItem,
  clearChecked,
  removeItem,
  renameItem,
  uncheckItem,
} from "./mutations";
import { getShoppingList } from "./queries";

// Délai propre aux tests base de ce fichier (base éphémère de la CI environ cinq fois plus lente).
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
    (e: unknown) => (e as { code?: string }).code ?? "autre",
  );

async function rev(workspace: string): Promise<number> {
  const { rows } = await owner.query<{ rev: string }>(
    "select rev::text as rev from shopping_lists where workspace_id = $1",
    [workspace],
  );
  return Number(rows[0]!.rev);
}

async function itemRow(id: string) {
  const { rows } = await owner.query<{
    label: string;
    aisle_key: string;
    aisle_pinned: boolean;
    checked: boolean;
  }>(
    "select label, aisle_key, aisle_pinned, checked_at is not null as checked from shopping_items where id = $1",
    [id],
  );
  return rows[0] ?? null;
}

const add = (label: string) =>
  db.asUser(f.userA, (tx) => addItem(f.workspaceA, label, tx));

async function aisleLabels(aisleKey: string) {
  const list = await db.asUser(f.userA, (tx) =>
    getShoppingList(f.workspaceA, tx),
  );
  return (
    list.aisles
      .find((g) => g.aisleKey === aisleKey)
      ?.items.map((i) => i.label) ?? []
  );
}

beforeAll(async () => {
  await insertCoreFixture(owner, f);
});

afterAll(async () => {
  try {
    await deleteShoppingFixture(owner, f);
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

describe("cocher et décocher", () => {
  it("un article coché passe en bas de son rayon, décoché il remonte", async () => {
    const first = await add("pomme");
    await add("poire");
    await add("banane");

    await db.asUser(f.userA, (tx) => checkItem(f.workspaceA, first.id, tx));
    expect(await aisleLabels("produce")).toEqual(["poire", "banane", "pomme"]);

    await db.asUser(f.userA, (tx) => uncheckItem(f.workspaceA, first.id, tx));
    expect(await aisleLabels("produce")).toEqual(["pomme", "poire", "banane"]);
  });

  it("cocher un article déjà coché garde sa date de cochage", async () => {
    const item = await add("kiwi");
    await db.asUser(f.userA, (tx) => checkItem(f.workspaceA, item.id, tx));
    const r0 = await rev(f.workspaceA);
    const { rows: before } = await owner.query<{ t: string }>(
      "select checked_at::text as t from shopping_items where id = $1",
      [item.id],
    );
    const again = await db.asUser(f.userA, (tx) =>
      checkItem(f.workspaceA, item.id, tx),
    );
    const { rows: after } = await owner.query<{ t: string }>(
      "select checked_at::text as t from shopping_items where id = $1",
      [item.id],
    );

    expect(after[0]!.t).toBe(before[0]!.t);
    // rev bouge quand même (choix documenté dans mutations.ts)
    expect(again.rev).toBe(r0 + 1);
  });

  it("chaque écriture incrémente rev de 1 et renvoie la nouvelle valeur", async () => {
    const item = await add("mangue");
    const r0 = await rev(f.workspaceA);

    const checked = await db.asUser(f.userA, (tx) =>
      checkItem(f.workspaceA, item.id, tx),
    );
    const unchecked = await db.asUser(f.userA, (tx) =>
      uncheckItem(f.workspaceA, item.id, tx),
    );

    expect(checked.rev).toBe(r0 + 1);
    expect(unchecked.rev).toBe(r0 + 2);
    expect(await rev(f.workspaceA)).toBe(r0 + 2);
  });
});

describe("renommer", () => {
  it("reclasse par classifyAisle quand le rayon n'a pas été choisi à la main", async () => {
    const item = await add("bidule");
    const r0 = await rev(f.workspaceA);

    const renamed = await db.asUser(f.userA, (tx) =>
      renameItem(f.workspaceA, item.id, "  Pain   complet ", tx),
    );

    expect(renamed).toMatchObject({
      label: "Pain complet",
      aisleKey: "bakery",
      rev: r0 + 1,
    });
    expect(await itemRow(item.id)).toMatchObject({
      label: "Pain complet",
      aisle_key: "bakery",
    });
  });

  it("garde le rayon choisi à la main (aisle_pinned)", async () => {
    const item = await add("truc");
    await owner.query(
      "update shopping_items set aisle_key = 'household', aisle_pinned = true where id = $1",
      [item.id],
    );

    const renamed = await db.asUser(f.userA, (tx) =>
      renameItem(f.workspaceA, item.id, "pain", tx),
    );

    expect(renamed.aisleKey).toBe("household");
    expect(await itemRow(item.id)).toMatchObject({
      label: "pain",
      aisle_key: "household",
      aisle_pinned: true,
    });
  });
});

describe("supprimer", () => {
  it("supprime l'article et incrémente rev ; un second appel est refusé sans toucher rev", async () => {
    const item = await add("radis");
    const r0 = await rev(f.workspaceA);

    const removed = await db.asUser(f.userA, (tx) =>
      removeItem(f.workspaceA, item.id, tx),
    );
    const again = await codeOf(
      db.asUser(f.userA, (tx) => removeItem(f.workspaceA, item.id, tx)),
    );

    expect(removed.rev).toBe(r0 + 1);
    expect(await itemRow(item.id)).toBeNull();
    expect(again).toBe("invalid_params");
    expect(await rev(f.workspaceA)).toBe(r0 + 1);
  });
});

describe("vider les cochés", () => {
  // Liste propre : le test ne dépend ni de l'ordre ni des articles des tests précédents.
  beforeEach(async () => {
    await owner.query("delete from shopping_items where workspace_id = $1", [
      f.workspaceA,
    ]);
  });

  it("supprime les cochés et eux seuls, rev + 1 une seule fois", async () => {
    const keep = await add("navet");
    const gone1 = await add("endive");
    const gone2 = await add("poireau");
    await db.asUser(f.userA, (tx) => checkItem(f.workspaceA, gone1.id, tx));
    await db.asUser(f.userA, (tx) => checkItem(f.workspaceA, gone2.id, tx));
    const r0 = await rev(f.workspaceA);

    const result = await db.asUser(f.userA, (tx) =>
      clearChecked(f.workspaceA, tx),
    );

    expect(result.removed).toBe(2);
    expect(result.rev).toBe(r0 + 1);
    expect(await itemRow(keep.id)).not.toBeNull();
    expect(await itemRow(gone1.id)).toBeNull();
    expect(await itemRow(gone2.id)).toBeNull();
    const { rows } = await owner.query<{ n: number }>(
      "select count(*)::int as n from shopping_items where workspace_id = $1 and checked_at is not null",
      [f.workspaceA],
    );
    expect(rows[0]!.n).toBe(0);
  });

  it("rien de coché : rien supprimé, rev inchangé", async () => {
    await add("persil");
    const r0 = await rev(f.workspaceA);

    const result = await db.asUser(f.userA, (tx) =>
      clearChecked(f.workspaceA, tx),
    );

    expect(result).toEqual({ removed: 0, rev: r0 });
  });
});

describe("concurrence : les écritures attendent le verrou de la liste", () => {
  /**
   * `holder` écrit (donc tient le verrou consultatif de la liste) et reste ouverte ; `op` est lancée ensuite
   * sur une autre connexion. Dit si `op` patiente sur un verrou consultatif, puis rend son code une fois
   * `holder` validée.
   */
  async function waitsOnListLock(
    op: (
      tx: Parameters<Parameters<typeof db.asUser>[1]>[0],
    ) => Promise<unknown>,
  ) {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let held = () => {};
    const holding = new Promise<void>((resolve) => (held = resolve));
    const holder = codeOf(
      db.asUser(f.userA, async (tx) => {
        await addItem(f.workspaceA, "tenu", tx);
        held();
        await gate;
      }),
    );
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));
    let blocked = false;
    let waiter: Promise<string> | null = null;
    try {
      await Promise.race([holding, holder]);
      waiter = codeOf(
        db.asUser(f.userA2, async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await op(tx);
        }),
      );
      void waiter.then(() => setPid(-1));
      blocked = await waitForLockWait(owner, await pid, "advisory");
    } finally {
      release();
    }
    return { blocked, codes: [await holder, await waiter!] };
  }

  it("cocher puis vider les cochés attendent un verrou consultatif", async () => {
    const item = await add("lait");

    const checking = await waitsOnListLock((tx) =>
      checkItem(f.workspaceA, item.id, tx),
    );
    const clearing = await waitsOnListLock((tx) =>
      clearChecked(f.workspaceA, tx),
    );

    expect(checking).toEqual({ blocked: true, codes: ["ok", "ok"] });
    expect(clearing).toEqual({ blocked: true, codes: ["ok", "ok"] });
  });

  it("renommer puis supprimer attendent un verrou consultatif", async () => {
    const item = await add("beurre");

    const renaming = await waitsOnListLock((tx) =>
      renameItem(f.workspaceA, item.id, "beurre doux", tx),
    );
    const removing = await waitsOnListLock((tx) =>
      removeItem(f.workspaceA, item.id, tx),
    );

    expect(renaming).toEqual({ blocked: true, codes: ["ok", "ok"] });
    expect(removing).toEqual({ blocked: true, codes: ["ok", "ok"] });
  });
});
