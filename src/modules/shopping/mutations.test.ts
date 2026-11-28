// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import { waitForLockWait } from "../../../tests/factories/lock-wait";
import { deleteShoppingFixture } from "../../../tests/factories/shopping";

import { addItem, ensureList, MAX_ITEMS_PER_LIST } from "./mutations";
import { getShoppingList } from "./queries";

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

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "autre",
  );

async function listState(workspace: string) {
  const { rows } = await owner.query<{ rev: string; items: number }>(
    `select l.rev::text as rev,
            (select count(*)::int from shopping_items i where i.list_id = l.id) as items
     from shopping_lists l where l.workspace_id = $1`,
    [workspace],
  );
  return { rev: Number(rows[0]!.rev), items: rows[0]!.items };
}

async function aisleOf(label: string, workspace: string) {
  const { rows } = await owner.query<{ aisle_key: string; label: string }>(
    "select aisle_key, label from shopping_items where workspace_id = $1 and label = $2",
    [workspace, label],
  );
  return rows;
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

describe("ensureList", () => {
  it("crée la liste « Courses » au premier accès, sans la dupliquer ensuite", async () => {
    const before = await db.asUser(f.userA, (tx) =>
      getShoppingList(f.workspaceA, tx),
    );
    const first = await db.asUser(f.userA, (tx) =>
      ensureList(f.workspaceA, tx),
    );
    const second = await db.asUser(f.userA2, (tx) =>
      ensureList(f.workspaceA, tx),
    );

    expect(before.id).toBeNull();
    expect(first).toMatchObject({ name: "Courses", rev: 0 });
    expect(second.id).toBe(first.id);
  });

  it("deux premiers accès simultanés ne créent qu'une liste", async () => {
    const [a, b] = await Promise.all([
      db.asUser(f.userB, (tx) => ensureList(f.workspaceB, tx)),
      db.asUser(f.userB, (tx) => ensureList(f.workspaceB, tx)),
    ]);

    expect(a.id).toBe(b.id);
  });
});

describe("addItem", () => {
  it("ajouter « pomme » la range dans Fruits et légumes", async () => {
    const added = await db.asUser(f.userA, (tx) =>
      addItem(f.workspaceA, "pomme", tx),
    );

    expect(added.aisleKey).toBe("produce");
    expect(await aisleOf("pomme", f.workspaceA)).toEqual([
      { aisle_key: "produce", label: "pomme" },
    ]);
  });

  it("range un inconnu dans Divers", async () => {
    const added = await db.asUser(f.userA, (tx) =>
      addItem(f.workspaceA, "bidule", tx),
    );

    expect(added.aisleKey).toBe("other");
  });

  it("garde le libellé saisi, bords retirés et espaces internes réduits", async () => {
    const added = await db.asUser(f.userA, (tx) =>
      addItem(f.workspaceA, "  Lait   demi-écrémé  ", tx),
    );

    expect(added.label).toBe("Lait demi-écrémé");
  });

  it("applique la correction de l'utilisateur, pas celle d'un autre", async () => {
    await owner.query(
      `insert into shopping_aisle_overrides (workspace_id, user_id, keyword, aisle_key)
       values ($1, $2, 'courgette', 'household')`,
      [f.workspaceA, f.userA],
    );

    const [mine, other] = await Promise.all([
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "Courgette", tx)),
      db.asUser(f.userA2, (tx) => addItem(f.workspaceA, "Courgette", tx)),
    ]);

    expect(mine.aisleKey).toBe("household");
    expect(other.aisleKey).toBe("produce");
  });

  it("refuse un libellé vide ou fait d'espaces", async () => {
    const codes = await Promise.all([
      codeOf(db.asUser(f.userA, (tx) => addItem(f.workspaceA, "", tx))),
      codeOf(db.asUser(f.userA, (tx) => addItem(f.workspaceA, "   ", tx))),
    ]);

    expect(codes).toEqual(["invalid_params", "invalid_params"]);
  });

  it("refuse un libellé de 81 caractères et accepte 80", async () => {
    const tooLong = await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "a".repeat(81), tx)),
    );
    const max = await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "é".repeat(80), tx)),
    );

    expect(tooLong).toBe("label_too_long");
    expect(max).toBe("ok");
  });

  it("refuse un workspaceId qui n'est pas un uuid", async () => {
    const code = await codeOf(
      db.asUser(f.userA, (tx) => addItem("pas-un-uuid", "pain", tx)),
    );

    expect(code).toBe("invalid_params");
  });

  it("fait augmenter rev d'un par écriture", async () => {
    const before = await listState(f.workspaceA);

    await db.asUser(f.userA, (tx) => addItem(f.workspaceA, "riz", tx));
    const afterOne = await listState(f.workspaceA);
    const added = await db.asUser(f.userA, (tx) =>
      addItem(f.workspaceA, "sel", tx),
    );
    const afterTwo = await listState(f.workspaceA);

    expect(afterOne.rev).toBe(before.rev + 1);
    expect(afterTwo.rev).toBe(before.rev + 2);
    expect(added.rev).toBe(afterTwo.rev);
  });

  it("n'incrémente pas rev quand l'ajout est refusé", async () => {
    const before = await listState(f.workspaceA);

    await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "a".repeat(81), tx)),
    );

    expect((await listState(f.workspaceA)).rev).toBe(before.rev);
  });
});

describe("addItem : plafond de 300 articles", () => {
  async function fillTo(count: number) {
    const { id } = await db.asUser(f.userA, (tx) =>
      ensureList(f.workspaceA, tx),
    );
    await owner.query("delete from shopping_items where workspace_id = $1", [
      f.workspaceA,
    ]);
    await owner.query(
      `insert into shopping_items (workspace_id, list_id, label, aisle_key)
       select $1, $2, 'x' || g, 'other' from generate_series(1, $3::int) g`,
      [f.workspaceA, id, count],
    );
  }

  it("la 301ᵉ ajout est refusé", async () => {
    await fillTo(MAX_ITEMS_PER_LIST);

    const code = await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "de trop", tx)),
    );

    expect(code).toBe("list_full");
    expect((await listState(f.workspaceA)).items).toBe(MAX_ITEMS_PER_LIST);
  });

  it("le 300ᵉ ajout est accepté", async () => {
    await fillTo(MAX_ITEMS_PER_LIST - 1);

    const code = await codeOf(
      db.asUser(f.userA, (tx) => addItem(f.workspaceA, "le dernier", tx)),
    );

    expect(code).toBe("ok");
  });

  /**
   * `first` ajoute puis reste ouverte ; `second` est lancée ensuite. Dit si `second` attend un verrou
   * consultatif (lockList avant tout verrou de ligne), puis rend les deux résultats une fois `first` validée.
   */
  async function secondAddWaitsOnListLock() {
    let commitFirst = () => {};
    const gate = new Promise<void>((resolve) => (commitFirst = resolve));
    let firstWritten = () => {};
    const written = new Promise<void>((resolve) => (firstWritten = resolve));
    const one = codeOf(
      db.asUser(f.userA, async (tx) => {
        await addItem(f.workspaceA, "course 1", tx);
        firstWritten();
        await gate;
      }),
    );
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));
    let blocked = false;
    let two: Promise<string> | null = null;
    try {
      await Promise.race([written, one]);
      two = codeOf(
        db.asUser(f.userA2, async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await addItem(f.workspaceA, "course 2", tx);
        }),
      );
      void two.then(() => setPid(-1));
      blocked = await waitForLockWait(owner, await pid, "advisory");
    } finally {
      commitFirst();
    }
    return { blocked, codes: [await one, await two!] };
  }

  // Un seul scénario pour les deux preuves (attente sur le verrou consultatif, puis un seul des deux ajouts
  // passe) : remplir 299 articles et ouvrir deux transactions croisées coûte cher sur la base éphémère de la CI.
  it("à 299 articles, le second ajout attend le verrou de la liste puis seul un des deux passe", async () => {
    await fillTo(MAX_ITEMS_PER_LIST - 1);

    const { blocked, codes } = await secondAddWaitsOnListLock();

    expect(blocked).toBe(true);
    expect(codes).toEqual(["ok", "list_full"]);
    expect((await listState(f.workspaceA)).items).toBe(MAX_ITEMS_PER_LIST);
  });
});
