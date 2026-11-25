// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createAsUser } from "../factories/backend-tx";
import {
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../factories/core";
import { errorTag } from "../factories/error-tag";
import {
  insertTasks,
  insertTasksFixture,
  newTasksFixture,
} from "../factories/tasks";

// Clé d'ordre et parente modifiable (drizzle/0008) : droits par colonne d'app_backend, collation de
// sort_key, clé étrangère de la parente. En app_backend, claims posés à la main, transactions annulées.

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/tasks-sort-key.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const OK = "ok";
const GRANT_REFUSAL = "42501:droit";
const FOREIGN_KEY_VIOLATION = "23503";

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

/**
 * Étiquette d'un refus, sans l'erreur brute du pilote (elle porte hôte et mot de passe) : le SQLSTATE.
 * 42501 couvre deux couches : « 42501:droit » (GRANT absent) ou « 42501:rls » (policy).
 */
function refusalTag(error: unknown): string {
  const tag = errorTag(error);
  if (tag !== "42501") return tag;
  const message = String((error as { message?: unknown }).message);
  return /permission denied/.test(message) ? `${tag}:droit` : `${tag}:rls`;
}

/** Ne laisse jamais sortir l'erreur brute : un test qui échoue n'affiche que l'étiquette. */
async function tagged<T>(query: Promise<T>): Promise<T> {
  try {
    return await query;
  } catch (error) {
    throw new Error(refusalTag(error));
  }
}

const rawAsUser = createAsUser(backend);
const asUser: typeof rawAsUser = (sub, run) => tagged(rawAsUser(sub, run));

/** Issue d'une écriture : « ok », ou l'étiquette du refus. */
async function outcome(write: Promise<unknown>): Promise<string> {
  try {
    await write;
    return OK;
  } catch (error) {
    return (error as Error).message;
  }
}

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
         values ($1, 'private', 'Avec clé', 'app', 'a0') returning sort_key`,
        [f.workspaceA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual(["a0"]);
  });

  it("app_backend modifie la clé d'ordre d'une tâche", async () => {
    const keys = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "update tasks set sort_key = 'a1' where id = $1 returning sort_key",
        [t.taskA],
      );
      return result.rows.map((row) => row.sort_key);
    });

    expect(keys).toEqual(["a1"]);
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
