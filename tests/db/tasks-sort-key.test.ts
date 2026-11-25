// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SORT_KEY_MAX_LENGTH } from "@/modules/tasks/sort-key";

import { createAsUser } from "../factories/backend-tx";
import {
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../factories/core";
import {
  CHECK_VIOLATION,
  FOREIGN_KEY_VIOLATION,
  GRANT_REFUSAL,
  OK,
  outcome,
  tagged,
} from "../factories/refusal";
import {
  insertTasks,
  insertTasksFixture,
  newTasksFixture,
} from "../factories/tasks";

// Clé d'ordre et parente modifiable (drizzle/0008) : droits par colonne d'app_backend, collation de
// sort_key, clé étrangère de la parente. Contraintes de drizzle/0010 : parente différente de la tâche,
// forme de la clé. En app_backend, claims posés à la main, transactions annulées.

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/tasks-sort-key.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();
const t = newTasksFixture();
/** tâche privée de A, de premier niveau, sans sous-tâche */
const looseA = randomUUID();
/** tâche pro de A, de premier niveau */
const proA = randomUUID();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertTasksFixture(owner, f, t);
  await insertTasks(owner, f.workspaceA, f.userA, [
    { id: looseA, side: "private", title: "Tâche libre" },
    { id: proA, side: "pro", title: "Tâche pro" },
  ]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

const rawAsUser = createAsUser(backend);
const asUser: typeof rawAsUser = (sub, run) => tagged(rawAsUser(sub, run));

function insertWithKeys(db: PoolClient, keys: string[]) {
  return db.query(
    `insert into tasks (workspace_id, side, title, origin, sort_key)
     select $1, 'private', 'clé ' || k, 'app', k from unnest($2::text[]) as k`,
    [f.workspaceA, keys],
  );
}

describe("tasks.sort_key : droits d'app_backend et ordre", () => {
  it("app_backend crée une tâche avec une clé d'ordre", async () => {
    const keys = await asUser(f.userA, async (db) => {
      const result = await db.query(
        `insert into tasks (workspace_id, side, title, origin, sort_key)
         values ($1, 'private', 'Avec clé', 'app', 'a1') returning sort_key`,
        [f.workspaceA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual(["a1"]);
  });

  it("app_backend modifie la clé d'ordre d'une tâche", async () => {
    const keys = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "update tasks set sort_key = 'a2' where id = $1 returning sort_key",
        [t.taskA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual(["a2"]);
  });

  it("accepte une tâche créée sans clé d'ordre (ancien code)", async () => {
    const keys = await asUser(f.userA, async (db) => {
      const result = await db.query(
        `insert into tasks (workspace_id, side, title, origin)
         values ($1, 'private', 'Sans clé', 'app') returning sort_key`,
        [f.workspaceA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual([null]);
  });

  it("range « B » avant « a » (ordre octet)", async () => {
    const keys = await asUser(f.userA, async (db) => {
      await insertWithKeys(db, ["a", "B", "b", "A"]);
      const result = await db.query(
        `select sort_key from tasks
         where workspace_id = $1 and sort_key is not null order by sort_key`,
        [f.workspaceA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual(["A", "B", "a", "b"]);
  });

  it('compare sort_key avec la collation "C", quelle que soit celle de la base', async () => {
    const result = await tagged(
      owner.query(
        `select collation_name from information_schema.columns
       where table_schema = 'public' and table_name = 'tasks' and column_name = 'sort_key'`,
      ),
    );

    expect(result.rows.map((row) => row.collation_name)).toEqual(["C"]);
  });

  it("indexe les tâches actives par workspace, catégorie et clé d'ordre", async () => {
    const result = await tagged(
      owner.query(
        `select indexdef from pg_indexes
       where schemaname = 'public' and indexname = 'tasks_workspace_status_sort_key_idx'`,
      ),
    );

    expect(result.rows.map((row) => row.indexdef)).toEqual([
      expect.stringMatching(
        /\(workspace_id, status_category, sort_key\) WHERE \(deleted_at IS NULL\)$/,
      ),
    ]);
  });
});

describe("tasks.parent_id : modifiable par app_backend, dans les limites de la clé étrangère", () => {
  it("app_backend rattache une tâche à une parente du même côté", async () => {
    const parents = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "update tasks set parent_id = $2 where id = $1 returning parent_id",
        [looseA, t.taskA],
      );
      return result.rows.map((row) => row.parent_id);
    });

    expect(parents).toEqual([t.taskA]);
  });

  it("app_backend détache une sous-tâche", async () => {
    const parents = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "update tasks set parent_id = null where id = $1 returning parent_id",
        [t.subtaskA],
      );
      return result.rows.map((row) => row.parent_id);
    });

    expect(parents).toEqual([null]);
  });

  it("refuse une parente de l'autre côté", async () => {
    const update = asUser(f.userA, (db) =>
      db.query("update tasks set parent_id = $2 where id = $1", [looseA, proA]),
    );

    expect(await outcome(update)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("refuse une parente d'un autre workspace, même du même côté", async () => {
    const update = asUser(f.userA, (db) =>
      db.query("update tasks set parent_id = $2 where id = $1", [
        proA,
        t.taskB,
      ]),
    );

    expect(await outcome(update)).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("tasks : contraintes de drizzle/0010 (parente et forme de la clé d'ordre)", () => {
  function setKey(key: string | null) {
    return asUser(f.userA, (db) =>
      db.query("update tasks set sort_key = $2 where id = $1", [t.taskA, key]),
    );
  }

  it("refuse une tâche parente d'elle-même, là où une autre parente du même côté passe", async () => {
    const setParent = (parentId: string) =>
      asUser(f.userA, (db) =>
        db.query("update tasks set parent_id = $2 where id = $1", [
          looseA,
          parentId,
        ]),
      );

    const outcomes = {
      self: await outcome(setParent(looseA)),
      other: await outcome(setParent(t.taskA)),
    };

    expect(outcomes).toEqual({ self: CHECK_VIOLATION, other: OK });
  });

  it.each([
    ["avec un caractère hors alphabet", "a_1"],
    ["avec une lettre accentuée", "é"],
    ["vide", ""],
    ["terminée par « 0 »", "a0"],
    ["terminée par un saut de ligne", "a\n"],
    [
      `de ${SORT_KEY_MAX_LENGTH + 1} caractères`,
      "a".repeat(SORT_KEY_MAX_LENGTH + 1),
    ],
  ])("refuse une clé d'ordre %s", async (_label, key) => {
    const update = setKey(key);

    expect(await outcome(update)).toBe(CHECK_VIOLATION);
  });

  it.each([
    [`de ${SORT_KEY_MAX_LENGTH} caractères`, "a".repeat(SORT_KEY_MAX_LENGTH)],
    ["NULL", null],
  ])("accepte une clé d'ordre %s", async (_label, key) => {
    const update = setKey(key);

    expect(await outcome(update)).toBe(OK);
  });

  it("porte les deux contraintes au catalogue, la longueur étant celle du module", async () => {
    const result = await tagged(
      owner.query<{ conname: string; definition: string }>(
        `select conname, pg_get_constraintdef(oid) as definition from pg_constraint
         where conrelid = 'public.tasks'::regclass
           and conname in ('tasks_parent_not_self_check', 'tasks_sort_key_check')
         order by conname`,
      ),
    );

    expect(result.rows).toEqual([
      {
        conname: "tasks_parent_not_self_check",
        definition: "CHECK ((parent_id <> id))",
      },
      {
        conname: "tasks_sort_key_check",
        definition: `CHECK (((sort_key ~ '^[0-9A-Za-z]+$'::text) AND (char_length(sort_key) <= ${SORT_KEY_MAX_LENGTH}) AND ("right"(sort_key, 1) <> '0'::text)))`,
      },
    ]);
  });
});

describe("tasks : colonnes toujours fermées à app_backend en UPDATE", () => {
  it("app_backend ne peut pas déplacer une tâche vers un autre workspace", async () => {
    const update = asUser(f.userA, (db) =>
      db.query("update tasks set workspace_id = $2 where id = $1", [
        t.taskA,
        f.workspaceB,
      ]),
    );

    expect(await outcome(update)).toBe(GRANT_REFUSAL);
  });

  it("app_backend ne peut pas modifier l'origine d'une tâche", async () => {
    const update = asUser(f.userA, (db) =>
      db.query("update tasks set origin = 'assistant' where id = $1", [
        t.taskA,
      ]),
    );

    expect(await outcome(update)).toBe(GRANT_REFUSAL);
  });
});
