// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AISLE_KEYS } from "../../src/modules/shopping/aisles";
import { createAsUser } from "../factories/backend-tx";
import {
  deleteCoreFixture,
  insertCoreFixture,
  insertDualMember,
  newCoreFixture,
} from "../factories/core";
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  GRANT_REFUSAL,
  OK,
  outcome,
  RLS_REFUSAL,
  tagged,
  UNIQUE_VIOLATION,
} from "../factories/refusal";
import {
  deleteShoppingFixture,
  insertShoppingFixture,
  newShoppingFixture,
} from "../factories/shopping";

// Isolation et contraintes des quatre tables de courses (drizzle/0011, ADR-002), en app_backend, claims
// posés à la main, AUCUN filtre applicatif. Les clauses `= any(...)` ne font que restreindre aux lignes
// de ce run. Chaque transaction d'app_backend est annulée ; les lignes de départ, posées par le
// propriétaire, partent avec deleteShoppingFixture puis deleteCoreFixture.
// Ces tests exigent la migration 0011 : rouges en local tant qu'elle n'est pas appliquée (jamais avant
// la fusion de sa PR, gotcha), verts sur la base éphémère de la CI.

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/isolation-shopping.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();
const s = newShoppingFixture();
const BOTH = [f.workspaceA, f.workspaceB];

beforeAll(async () => {
  await tagged(
    (async () => {
      await insertCoreFixture(owner, f);
      await insertDualMember(owner, f);
      await insertShoppingFixture(owner, f, s);
    })(),
  );
});

// Exécuté même si l'insertion échoue à mi-chemin : suppression par workspace.
afterAll(async () => {
  try {
    await tagged(
      (async () => {
        await deleteShoppingFixture(owner, f);
        await deleteCoreFixture(owner, f);
      })(),
    );
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

const rawAsUser = createAsUser(backend);
const asUser: typeof rawAsUser = (sub, run) => tagged(rawAsUser(sub, run));

async function count(db: PoolClient, table: string, workspaceIds: string[]) {
  const result = await db.query(
    `select count(*)::int as n from ${table} where workspace_id = any($1)`,
    [workspaceIds],
  );
  return result.rows[0].n as number;
}

const TABLES = [
  "shopping_lists",
  "shopping_items",
  "shopping_aisle_overrides",
  "shopping_aisle_order",
];

describe("isolation des tables de courses : lecture", () => {
  it.each(TABLES)(
    "l'utilisateur de B ne lit rien de A dans %s",
    async (table) => {
      const seen = await asUser(f.userB, (db) =>
        count(db, table, [f.workspaceA]),
      );

      expect(seen).toBe(0);
    },
  );

  it.each(TABLES)("sans claims, ne lit rien dans %s", async (table) => {
    const seen = await asUser(null, (db) => count(db, table, BOTH));

    expect(seen).toBe(0);
  });

  it("un membre de A lit la liste et les articles de A, pas ceux de B", async () => {
    const seen = await asUser(f.userA2, async (db) => ({
      lists: (
        await db.query(
          "select id from shopping_lists where workspace_id = any($1)",
          [BOTH],
        )
      ).rows.map((row) => row.id),
      items: await count(db, "shopping_items", BOTH),
    }));

    expect(seen).toEqual({ lists: [s.listA], items: 2 });
  });

  it("l'utilisateur de B lit sa propre liste, son article, sa correction et son ordre", async () => {
    const seen = await asUser(f.userB, async (db) => ({
      lists: await count(db, "shopping_lists", BOTH),
      items: await count(db, "shopping_items", BOTH),
      overrides: await count(db, "shopping_aisle_overrides", BOTH),
      order: await count(db, "shopping_aisle_order", BOTH),
    }));

    expect(seen).toEqual({ lists: 1, items: 1, overrides: 1, order: 1 });
  });
});

describe("shopping_lists : écriture et défauts", () => {
  it("rev vaut 0 et channel_id est un uuid propre à chaque liste par défaut", async () => {
    const rows = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "select id, rev::text as rev, channel_id from shopping_lists where workspace_id = any($1)",
        [BOTH],
      );
      return result.rows;
    });

    const [rowA] = rows;
    expect(rows).toHaveLength(1);
    expect({ id: rowA.id, rev: rowA.rev }).toEqual({ id: s.listA, rev: "0" });
    expect(rowA.channel_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("deux listes n'ont jamais le même channel_id", async () => {
    const distinct = await tagged(
      owner
        .query(
          "select count(distinct channel_id)::int as n from shopping_lists where id = any($1)",
          [[s.listA, s.listB]],
        )
        .then((r) => r.rows[0].n as number),
    );

    expect(distinct).toBe(2);
  });

  it("l'utilisateur de B ne peut pas créer de liste dans A (un membre de A est arrêté par l'unicité, pas par la RLS)", async () => {
    const attempt = (sub: string) =>
      outcome(
        asUser(sub, (db) =>
          db.query(
            "insert into shopping_lists (workspace_id, name) values ($1, 'Autre')",
            [f.workspaceA],
          ),
        ),
      );

    const outcomes = {
      userB: await attempt(f.userB),
      memberOfA: await attempt(f.userA2),
    };

    expect(outcomes).toEqual({
      userB: RLS_REFUSAL,
      memberOfA: UNIQUE_VIOLATION,
    });
  });

  it("une seule liste par workspace", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(
        "insert into shopping_lists (workspace_id, name) values ($1, 'Doublon')",
        [f.workspaceA],
      ),
    );

    expect(await outcome(insert)).toBe(UNIQUE_VIOLATION);
  });

  it("un membre de A incrémente rev ; l'utilisateur de B ne touche aucune ligne de A", async () => {
    const bump = (sub: string) =>
      asUser(
        sub,
        async (db) =>
          (
            await db.query(
              "update shopping_lists set rev = rev + 1 where id = $1 returning rev::text as rev",
              [s.listA],
            )
          ).rows,
      );

    const results = {
      userB: await bump(f.userB),
      memberOfA: await bump(f.userA2),
    };

    expect(results).toEqual({ userB: [], memberOfA: [{ rev: "1" }] });
  });

  it.each([
    [
      "channel_id",
      "update shopping_lists set channel_id = gen_random_uuid() where id = $1",
    ],
    [
      "workspace_id",
      "update shopping_lists set workspace_id = workspace_id where id = $1",
    ],
    [
      "updated_at",
      "update shopping_lists set updated_at = now() where id = $1",
    ],
  ])(
    "app_backend ne peut pas modifier %s d'une liste (droit, pas RLS)",
    async (_label, sql) => {
      const update = asUser(f.userA, (db) => db.query(sql, [s.listA]));

      expect(await outcome(update)).toBe(GRANT_REFUSAL);
    },
  );

  it("app_backend ne peut pas poser channel_id ni rev à la création (droit de colonne)", async () => {
    const attempt = (column: string, value: string) =>
      outcome(
        asUser(f.userA, (db) =>
          db.query(
            `insert into shopping_lists (workspace_id, name, ${column}) values ($1, 'x', ${value})`,
            [f.workspaceA],
          ),
        ),
      );

    const outcomes = {
      channelId: await attempt("channel_id", "gen_random_uuid()"),
      rev: await attempt("rev", "5"),
    };

    expect(outcomes).toEqual({
      channelId: GRANT_REFUSAL,
      rev: GRANT_REFUSAL,
    });
  });

  it("personne ne supprime une liste (aucun droit DELETE)", async () => {
    const remove = asUser(f.userA, (db) =>
      db.query("delete from shopping_lists where id = $1", [s.listA]),
    );

    expect(await outcome(remove)).toBe(GRANT_REFUSAL);
  });
});

const INSERT_ITEM =
  "insert into shopping_items (workspace_id, list_id, label, aisle_key) values ($1, $2, $3, $4)";

describe("shopping_items : isolation et contraintes", () => {
  it("l'utilisateur de B ne peut pas ajouter un article dans A (la même instruction passe pour un membre de A)", async () => {
    const attempt = (sub: string) =>
      outcome(
        asUser(sub, (db) =>
          db.query(INSERT_ITEM, [f.workspaceA, s.listA, "beurre", "dairyEggs"]),
        ),
      );

    const outcomes = {
      userB: await attempt(f.userB),
      memberOfA: await attempt(f.userA2),
    };

    expect(outcomes).toEqual({ userB: RLS_REFUSAL, memberOfA: OK });
  });

  // userAB est membre de A et de B : la RLS laisse passer les deux workspace_id, seule la clé étrangère
  // composite répond.
  it.each([
    ["A", () => [f.workspaceA, s.listB]],
    ["B", () => [f.workspaceB, s.listA]],
  ])(
    "refuse un article rangé dans %s sur la liste de l'autre workspace, même pour un membre des deux (clé étrangère composite)",
    async (_workspace, params) => {
      const [workspaceId, listId] = params();

      const insert = asUser(f.userAB, (db) =>
        db.query(INSERT_ITEM, [workspaceId, listId, "intrus", "produce"]),
      );

      expect(await outcome(insert)).toBe(FOREIGN_KEY_VIOLATION);
    },
  );

  it("refuse une clé de rayon inconnue", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(INSERT_ITEM, [f.workspaceA, s.listA, "x", "garage"]),
    );

    expect(await outcome(insert)).toBe(CHECK_VIOLATION);
  });

  it.each(AISLE_KEYS.map((key) => [key]))(
    "accepte la clé de rayon « %s »",
    async (key) => {
      const insert = asUser(f.userA, (db) =>
        db.query(INSERT_ITEM, [f.workspaceA, s.listA, "x", key]),
      );

      expect(await outcome(insert)).toBe(OK);
    },
  );

  it("accepte un libellé de 80 caractères et refuse 81, vide ou blanc", async () => {
    const attempt = (label: string) =>
      outcome(
        asUser(f.userA, (db) =>
          db.query(INSERT_ITEM, [f.workspaceA, s.listA, label, "other"]),
        ),
      );

    const outcomes = {
      eighty: await attempt("a".repeat(80)),
      eightyOne: await attempt("a".repeat(81)),
      empty: await attempt(""),
      blank: await attempt("   "),
    };

    expect(outcomes).toEqual({
      eighty: OK,
      eightyOne: CHECK_VIOLATION,
      empty: CHECK_VIOLATION,
      blank: CHECK_VIOLATION,
    });
  });

  it("added_by_guest et aisle_pinned valent false par défaut ; added_by_guest n'est pas posable par l'app", async () => {
    const defaults = await asUser(f.userA, async (db) => {
      const result = await db.query(
        `${INSERT_ITEM} returning added_by_guest, aisle_pinned, checked_at, id is not null as has_id, updated_at`,
        [f.workspaceA, s.listA, "thé", "drinks"],
      );
      return result.rows;
    });
    const guest = asUser(f.userA, (db) =>
      db.query(
        "insert into shopping_items (workspace_id, list_id, label, aisle_key, added_by_guest) values ($1, $2, 'x', 'other', true)",
        [f.workspaceA, s.listA],
      ),
    );

    expect(defaults).toEqual([
      {
        added_by_guest: false,
        aisle_pinned: false,
        checked_at: null,
        has_id: true,
        updated_at: null,
      },
    ]);
    expect(await outcome(guest)).toBe(GRANT_REFUSAL);
  });

  it("l'utilisateur de B ne coche, ne renomme ni ne supprime un article de A (la même instruction touche une ligne pour un membre de A)", async () => {
    const run = (sub: string, sql: string) =>
      asUser(sub, async (db) => (await db.query(sql, [s.itemA])).rows);
    const statements = {
      check:
        "update shopping_items set checked_at = now() where id = $1 returning id",
      rename:
        "update shopping_items set label = 'x' where id = $1 returning id",
      remove: "delete from shopping_items where id = $1 returning id",
    };

    const outcomes = {
      userB: [
        await run(f.userB, statements.check),
        await run(f.userB, statements.rename),
        await run(f.userB, statements.remove),
      ],
      memberOfA: [
        await run(f.userA2, statements.check),
        await run(f.userA2, statements.rename),
        await run(f.userA2, statements.remove),
      ],
    };

    expect(outcomes).toEqual({
      userB: [[], [], []],
      memberOfA: [[{ id: s.itemA }], [{ id: s.itemA }], [{ id: s.itemA }]],
    });
  });

  it.each([
    [
      "workspace_id",
      "update shopping_items set workspace_id = workspace_id where id = $1",
    ],
    ["list_id", "update shopping_items set list_id = list_id where id = $1"],
    [
      "added_by_guest",
      "update shopping_items set added_by_guest = true where id = $1",
    ],
    [
      "updated_at",
      "update shopping_items set updated_at = now() where id = $1",
    ],
  ])(
    "app_backend ne peut pas modifier %s d'un article (droit, pas RLS)",
    async (_label, sql) => {
      const update = asUser(f.userA, (db) => db.query(sql, [s.itemA]));

      expect(await outcome(update)).toBe(GRANT_REFUSAL);
    },
  );

  it("updated_at est posé par la base à la modification", async () => {
    const rows = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "update shopping_items set aisle_pinned = true where id = $1 returning updated_at is not null as stamped",
        [s.itemA],
      );
      return result.rows;
    });

    expect(rows).toEqual([{ stamped: true }]);
  });
});

describe("shopping_aisle_overrides : par utilisateur", () => {
  const INSERT_OVERRIDE =
    "insert into shopping_aisle_overrides (workspace_id, keyword, aisle_key) values ($1, $2, $3)";

  it("un second utilisateur du même workspace ne lit pas les corrections du premier", async () => {
    const seen = await asUser(f.userA2, (db) =>
      count(db, "shopping_aisle_overrides", BOTH),
    );
    const own = await asUser(f.userA, (db) =>
      count(db, "shopping_aisle_overrides", BOTH),
    );

    expect({ userA2: seen, userA: own }).toEqual({ userA2: 0, userA: 1 });
  });

  it("un second utilisateur du même workspace ne modifie ni ne supprime la correction du premier", async () => {
    const results = await asUser(f.userA2, async (db) => ({
      update: (
        await db.query(
          "update shopping_aisle_overrides set aisle_key = 'drinks' where id = $1 returning id",
          [s.overrideA],
        )
      ).rows,
    }));
    const upsertAsA2 = await asUser(f.userA2, (db) =>
      db.query(
        `${INSERT_OVERRIDE} on conflict (workspace_id, user_id, keyword) do update set aisle_key = excluded.aisle_key returning user_id, aisle_key`,
        [f.workspaceA, "bidule", "frozen"],
      ),
    );
    const ownerView = await owner.query(
      "select aisle_key from shopping_aisle_overrides where id = $1",
      [s.overrideA],
    );

    expect(results.update).toEqual([]);
    expect(upsertAsA2.rows).toEqual([
      { user_id: f.userA2, aisle_key: "frozen" },
    ]);
    expect(ownerView.rows).toEqual([{ aisle_key: "household" }]);
  });

  it("user_id vaut l'utilisateur connecté par défaut et n'est pas posable par l'app", async () => {
    const mine = await asUser(f.userA2, async (db) => {
      const result = await db.query(`${INSERT_OVERRIDE} returning user_id`, [
        f.workspaceA,
        "nouveau",
        "frozen",
      ]);
      return result.rows;
    });
    const forged = asUser(f.userA2, (db) =>
      db.query(
        "insert into shopping_aisle_overrides (workspace_id, user_id, keyword, aisle_key) values ($1, $2, 'x', 'frozen')",
        [f.workspaceA, f.userA],
      ),
    );

    expect(mine).toEqual([{ user_id: f.userA2 }]);
    expect(await outcome(forged)).toBe(GRANT_REFUSAL);
  });

  it("l'utilisateur de B ne peut rien écrire dans A", async () => {
    const insert = asUser(f.userB, (db) =>
      db.query(INSERT_OVERRIDE, [f.workspaceA, "truc", "frozen"]),
    );

    expect(await outcome(insert)).toBe(RLS_REFUSAL);
  });

  it("refuse une clé de rayon inconnue et un mot-clé de plus de 80 caractères ou vide", async () => {
    const attempt = (keyword: string, aisle: string) =>
      outcome(
        asUser(f.userA, (db) =>
          db.query(INSERT_OVERRIDE, [f.workspaceA, keyword, aisle]),
        ),
      );

    const outcomes = {
      unknownAisle: await attempt("x", "garage"),
      eighty: await attempt("a".repeat(80), "other"),
      eightyOne: await attempt("a".repeat(81), "other"),
      empty: await attempt("", "other"),
    };

    expect(outcomes).toEqual({
      unknownAisle: CHECK_VIOLATION,
      eighty: OK,
      eightyOne: CHECK_VIOLATION,
      empty: CHECK_VIOLATION,
    });
  });

  it("un mot-clé est unique par (workspace, utilisateur) mais pas entre utilisateurs", async () => {
    const attempt = (sub: string) =>
      outcome(
        asUser(sub, (db) =>
          db.query(INSERT_OVERRIDE, [f.workspaceA, "bidule", "other"]),
        ),
      );

    const outcomes = {
      sameUser: await attempt(f.userA),
      otherUser: await attempt(f.userA2),
    };

    expect(outcomes).toEqual({ sameUser: UNIQUE_VIOLATION, otherUser: OK });
  });
});

describe("shopping_aisle_order : par utilisateur", () => {
  const INSERT_ORDER =
    "insert into shopping_aisle_order (workspace_id, aisle_keys) values ($1, $2)";

  it("un second utilisateur du même workspace ne lit ni ne modifie l'ordre du premier", async () => {
    const seen = await asUser(f.userA2, async (db) => ({
      read: await count(db, "shopping_aisle_order", BOTH),
      update: (
        await db.query(
          "update shopping_aisle_order set aisle_keys = array['other'] where workspace_id = $1 returning user_id",
          [f.workspaceA],
        )
      ).rows,
    }));
    const ownerView = await owner.query(
      "select aisle_keys from shopping_aisle_order where workspace_id = $1 and user_id = $2",
      [f.workspaceA, f.userA],
    );

    expect(seen).toEqual({ read: 0, update: [] });
    expect(ownerView.rows).toEqual([{ aisle_keys: ["frozen", "produce"] }]);
  });

  it("l'utilisateur de B ne peut rien écrire dans A", async () => {
    const insert = asUser(f.userB, (db) =>
      db.query(INSERT_ORDER, [f.workspaceA, ["produce"]]),
    );

    expect(await outcome(insert)).toBe(RLS_REFUSAL);
  });

  it("un utilisateur n'a qu'un ordre par workspace, et user_id vaut l'utilisateur connecté", async () => {
    const dup = asUser(f.userA, (db) =>
      db.query(INSERT_ORDER, [f.workspaceA, ["produce"]]),
    );
    const mine = await asUser(f.userA2, async (db) => {
      const result = await db.query(`${INSERT_ORDER} returning user_id`, [
        f.workspaceA,
        ["produce"],
      ]);
      return result.rows;
    });

    expect(await outcome(dup)).toBe(UNIQUE_VIOLATION);
    expect(mine).toEqual([{ user_id: f.userA2 }]);
  });

  it("accepte les 12 rayons, refuse un 13e élément et une clé inconnue", async () => {
    const attempt = (keys: string[]) =>
      outcome(
        asUser(f.userA2, (db) => db.query(INSERT_ORDER, [f.workspaceA, keys])),
      );

    const outcomes = {
      twelve: await attempt([...AISLE_KEYS]),
      thirteen: await attempt([...AISLE_KEYS, "produce"]),
      unknown: await attempt(["garage"]),
    };

    expect(outcomes).toEqual({
      twelve: OK,
      thirteen: CHECK_VIOLATION,
      unknown: CHECK_VIOLATION,
    });
  });
});
