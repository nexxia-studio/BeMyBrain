// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deleteCoreFixture,
  insertCoreFixture,
  insertDualMember,
  newCoreFixture,
} from "../factories/core";
import { createAsUser } from "../factories/backend-tx";

// Schéma de la to-do (drizzle/0006_tasks.sql) : contraintes, FK composites, droits et triggers,
// vérifiés sur la branche test en app_backend, claims posés à la main, sans filtre applicatif.
// Chaque transaction est annulée : rien ne reste dans tasks, tags ni task_tags après ce fichier.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/schema-tasks.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertDualMember(owner, f);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

const asUser = createAsUser(backend);

type TaskInput = {
  workspaceId?: string;
  side?: string;
  contextId?: string | null;
  parentId?: string | null;
  title?: string;
  notes?: string | null;
  statusCategory?: string;
  priority?: number;
  dueDate?: string | null;
  dueTime?: string | null;
  origin?: string;
};

/** Insère une tâche (valeurs valides par défaut, workspace A, côté privé) et renvoie son id. */
async function insertTask(db: PoolClient, input: TaskInput = {}) {
  const result = await db.query(
    `insert into tasks (workspace_id, side, context_id, parent_id, title, notes, status_category,
       priority, due_date, due_time, origin)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [
      input.workspaceId ?? f.workspaceA,
      input.side ?? "private",
      input.contextId ?? null,
      input.parentId ?? null,
      input.title ?? "Relancer le devis",
      input.notes ?? null,
      input.statusCategory ?? "unstarted",
      input.priority ?? 0,
      input.dueDate ?? null,
      input.dueTime ?? null,
      input.origin ?? "app",
    ],
  );
  return result.rows[0].id as string;
}

async function insertTag(db: PoolClient, workspaceId: string, name: string) {
  const result = await db.query(
    "insert into tags (workspace_id, name) values ($1, $2) returning id",
    [workspaceId, name],
  );
  return result.rows[0].id as string;
}

async function insertContext(
  db: PoolClient,
  workspaceId: string,
  kind: "private" | "pro",
) {
  const result = await db.query(
    "insert into contexts (workspace_id, name, kind) values ($1, $2, $3) returning id",
    [workspaceId, `ctx-${kind}-${f.run}`, kind],
  );
  return result.rows[0].id as string;
}

async function readTask(db: PoolClient, id: string) {
  const result = await db.query(
    "select side, context_id, created_by, created_at, updated_at, origin from tasks where id = $1",
    [id],
  );
  return result.rows[0];
}

describe("tasks : contraintes CHECK", () => {
  it.each([
    ["une catégorie de statut inconnue", { statusCategory: "done" }],
    ["une priorité hors 0 à 4", { priority: 5 }],
    ["une priorité négative", { priority: -1 }],
    ["un titre vide après trim", { title: "   " }],
    ["un titre de plus de 500 caractères", { title: "a".repeat(501) }],
    ["des notes de plus de 10 000 caractères", { notes: "a".repeat(10_001) }],
    ["une heure sans date", { dueTime: "14:00" }],
    ["un côté hors private/pro", { side: "perso" }],
    ["une origine inconnue", { origin: "api" }],
  ])("refuse %s", async (_label, input) => {
    const insert = asUser(f.userA, (db) => insertTask(db, input));

    await expect(insert).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("accepte une tâche complète avec date et heure", async () => {
    const id = await asUser(f.userA, (db) =>
      insertTask(db, {
        notes: "a".repeat(10_000),
        title: "a".repeat(500),
        statusCategory: "started",
        priority: 4,
        dueDate: "2026-11-20",
        dueTime: "14:00",
        origin: "palette",
      }),
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("tasks : clés étrangères composites", () => {
  it("refuse un espace d'un autre workspace", async () => {
    const insert = asUser(f.userAB, (db) =>
      insertTask(db, { contextId: f.contextB, side: "pro" }),
    );

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it("refuse une tâche parente d'un autre workspace", async () => {
    const insert = asUser(f.userAB, async (db) => {
      const parentB = await insertTask(db, { workspaceId: f.workspaceB });
      return insertTask(db, { parentId: parentB });
    });

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it("refuse un tag d'un autre workspace sur une tâche", async () => {
    const insert = asUser(f.userAB, async (db) => {
      const tagB = await insertTag(db, f.workspaceB, "client");
      const taskA = await insertTask(db);
      return db.query(
        "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3)",
        [f.workspaceA, taskA, tagB],
      );
    });

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it("refuse une sous-tâche d'un côté différent de sa parente", async () => {
    const insert = asUser(f.userA, async (db) => {
      const parent = await insertTask(db, { side: "private" });
      return insertTask(db, { parentId: parent, side: "pro" });
    });

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it("refuse une tâche d'un côté différent de son espace", async () => {
    // contextA est un espace privé.
    const insert = asUser(f.userA, (db) =>
      insertTask(db, { contextId: f.contextA, side: "pro" }),
    );

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it("accepte une sous-tâche du côté de sa parente, dans le même espace", async () => {
    const id = await asUser(f.userA, async (db) => {
      const parent = await insertTask(db, { contextId: f.contextA });
      return insertTask(db, { parentId: parent, contextId: f.contextA });
    });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("tasks : droits d'app_backend", () => {
  it("refuse DELETE FROM tasks (42501)", async () => {
    const remove = asUser(f.userA, async (db) => {
      const id = await insertTask(db);
      return db.query("delete from tasks where id = $1", [id]);
    });

    await expect(remove).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("pose created_by depuis l'utilisateur connecté", async () => {
    const createdBy = await asUser(f.userA2, async (db) => {
      const id = await insertTask(db);
      return (await readTask(db, id)).created_by;
    });

    expect(createdBy).toBe(f.userA2);
  });

  it("refuse un created_by fourni par l'app", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(
        "insert into tasks (workspace_id, side, title, origin, created_by) values ($1, 'private', 't', 'app', $2)",
        [f.workspaceA, f.userA2],
      ),
    );

    await expect(insert).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it.each([
    ["origin", "'assistant'"],
    ["created_by", "gen_random_uuid()"],
    ["updated_at", "now()"],
    ["workspace_id", "workspace_id"],
    ["parent_id", "null"],
  ])("refuse la modification de %s", async (column, value) => {
    const update = asUser(f.userA, async (db) => {
      const id = await insertTask(db);
      return db.query(`update tasks set ${column} = ${value} where id = $1`, [
        id,
      ]);
    });

    await expect(update).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("tient updated_at par trigger : vide à la création, posé à la modification", async () => {
    const stamps = await asUser(f.userA, async (db) => {
      const id = await insertTask(db);
      const before = (await readTask(db, id)).updated_at;
      await db.query(
        "update tasks set title = 'Relancer le devis signé' where id = $1",
        [id],
      );
      return { before, after: (await readTask(db, id)).updated_at };
    });

    expect(stamps.before).toBeNull();
    expect(stamps.after).toBeInstanceOf(Date);
  });

  it("met une tâche à la corbeille et la restaure (deleted_at modifiable)", async () => {
    const rowCounts = await asUser(f.userA, async (db) => {
      const id = await insertTask(db);
      const trashed = await db.query(
        "update tasks set deleted_at = now() where id = $1",
        [id],
      );
      const restored = await db.query(
        "update tasks set deleted_at = null where id = $1",
        [id],
      );
      return [trashed.rowCount, restored.rowCount];
    });

    expect(rowCounts).toEqual([1, 1]);
  });
});

describe("tasks : suivi de l'espace", () => {
  it("la suppression d'un espace vide context_id et garde le côté", async () => {
    const task = await asUser(f.userA, async (db) => {
      const context = await insertContext(db, f.workspaceA, "pro");
      const id = await insertTask(db, { contextId: context, side: "pro" });
      await db.query("delete from contexts where id = $1", [context]);
      return readTask(db, id);
    });

    expect(task).toMatchObject({ context_id: null, side: "pro" });
  });

  it("le changement de type d'un espace change le côté de ses tâches et sous-tâches", async () => {
    const sides = await asUser(f.userA, async (db) => {
      const context = await insertContext(db, f.workspaceA, "pro");
      const parent = await insertTask(db, { contextId: context, side: "pro" });
      const child = await insertTask(db, {
        contextId: context,
        side: "pro",
        parentId: parent,
      });
      await db.query("update contexts set kind = 'private' where id = $1", [
        context,
      ]);
      return [
        (await readTask(db, parent)).side,
        (await readTask(db, child)).side,
      ];
    });

    expect(sides).toEqual(["private", "private"]);
  });
});

describe("tags et task_tags", () => {
  it("refuse deux tags de même nom à la casse près dans un workspace", async () => {
    const insert = asUser(f.userA, async (db) => {
      await insertTag(db, f.workspaceA, "Client");
      return insertTag(db, f.workspaceA, "client");
    });

    await expect(insert).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it.each([
    ["vide après trim", "  "],
    ["de plus de 50 caractères", "a".repeat(51)],
  ])("refuse un nom de tag %s", async (_label, name) => {
    const insert = asUser(f.userA, (db) => insertTag(db, f.workspaceA, name));

    await expect(insert).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("refuse DELETE FROM tags (42501)", async () => {
    const remove = asUser(f.userA, async (db) => {
      const id = await insertTag(db, f.workspaceA, "client");
      return db.query("delete from tags where id = $1", [id]);
    });

    await expect(remove).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("ajoute puis retire un tag d'une tâche", async () => {
    const rowCounts = await asUser(f.userA, async (db) => {
      const task = await insertTask(db);
      const tag = await insertTag(db, f.workspaceA, "client");
      const linked = await db.query(
        "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3)",
        [f.workspaceA, task, tag],
      );
      const unlinked = await db.query(
        "delete from task_tags where task_id = $1 and tag_id = $2",
        [task, tag],
      );
      return [linked.rowCount, unlinked.rowCount];
    });

    expect(rowCounts).toEqual([1, 1]);
  });
});

describe("RLS : activée, une policy par verbe autorisé", () => {
  it("tasks, tags et task_tags ont la RLS et les policies attendues pour app_backend", async () => {
    const result = await owner.query(
      `select c.relname as table, c.relrowsecurity as rls,
         coalesce(array_agg(p.cmd::text order by p.cmd) filter (where p.policyname is not null), '{}') as verbs
       from pg_class c
       left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
         and p.roles = '{app_backend}'
       join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       where c.relname in ('tasks', 'tags', 'task_tags')
       group by c.relname, c.relrowsecurity
       order by c.relname`,
    );

    expect(result.rows).toEqual([
      { table: "tags", rls: true, verbs: ["INSERT", "SELECT", "UPDATE"] },
      {
        table: "task_tags",
        rls: true,
        verbs: ["DELETE", "INSERT", "SELECT"],
      },
      { table: "tasks", rls: true, verbs: ["INSERT", "SELECT", "UPDATE"] },
    ]);
  });
});
