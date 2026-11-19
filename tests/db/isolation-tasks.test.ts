// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../factories/core";
import { insertTasksFixture, newTasksFixture } from "../factories/tasks";

// Isolation de la to-do au niveau de la base (ADR-002) : tasks, tags, task_tags, en app_backend,
// claims posés à la main, AUCUN filtre applicatif. Les clauses `= any(...)` ne font que restreindre
// aux lignes de ce run. Chaque transaction est annulée.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/isolation-tasks.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const INSUFFICIENT_PRIVILEGE = "42501"; // GRANT absent ou WITH CHECK de la RLS
const FOREIGN_KEY_VIOLATION = "23503";

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();
const t = newTasksFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertTasksFixture(owner, f, t);
});

// Exécuté même si l'insertion échoue à mi-chemin : suppression par workspace.
afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

/** Transaction app_backend avec les claims de `sub` (aucun si null), toujours annulée. */
async function asUser<T>(
  sub: string | null,
  run: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await backend.connect();
  try {
    await client.query("begin");
    // Comme withUserDb : charger pg_session_jwt avant set_config, sinon un backend neuf perd les claims.
    await client.query("select app.current_user_id()");
    if (sub) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role: "authenticated" }),
      ]);
    }
    return await run(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

type Table = "tasks" | "tags" | "task_tags";

async function countByWorkspace(
  db: PoolClient,
  table: Table,
  workspaceIds: string[],
): Promise<number> {
  const result = await db.query(
    `select count(*)::int as n from ${table} where workspace_id = any($1)`,
    [workspaceIds],
  );
  return result.rows[0].n;
}

async function countAll(db: PoolClient, workspaceIds: string[]) {
  return {
    tasks: await countByWorkspace(db, "tasks", workspaceIds),
    tags: await countByWorkspace(db, "tags", workspaceIds),
    taskTags: await countByWorkspace(db, "task_tags", workspaceIds),
  };
}

async function rowCount(db: PoolClient, sql: string, params: unknown[]) {
  return (await db.query(sql, params)).rowCount;
}

describe("isolation de tasks, tags, task_tags : lecture", () => {
  it("l'utilisateur de B ne lit aucune tâche, aucun tag ni aucun lien de A, corbeille comprise", async () => {
    const seen = await asUser(f.userB, (db) => countAll(db, [f.workspaceA]));

    expect(seen).toEqual({ tasks: 0, tags: 0, taskTags: 0 });
  });

  it("l'utilisateur de B lit ses propres tâches, tags et liens", async () => {
    const seen = await asUser(f.userB, (db) =>
      countAll(db, [f.workspaceA, f.workspaceB]),
    );

    expect(seen).toEqual({ tasks: 2, tags: 1, taskTags: 1 });
  });

  it("un membre de A lit les tâches de A, sous-tâche et corbeille comprises", async () => {
    const seen = await asUser(f.userA2, (db) =>
      countAll(db, [f.workspaceA, f.workspaceB]),
    );

    expect(seen).toEqual({ tasks: 3, tags: 1, taskTags: 1 });
  });

  it("sans claims, ne lit rien", async () => {
    const seen = await asUser(null, (db) =>
      countAll(db, [f.workspaceA, f.workspaceB]),
    );

    expect(seen).toEqual({ tasks: 0, tags: 0, taskTags: 0 });
  });
});

describe("isolation de tasks, tags, task_tags : insertion", () => {
  it.each([
    [
      "une tâche",
      "insert into tasks (workspace_id, side, title, origin) values ($1, 'private', 'intrus', 'app')",
      () => [f.workspaceA],
    ],
    [
      "une sous-tâche d'une tâche de A",
      "insert into tasks (workspace_id, side, parent_id, title, origin) values ($1, 'private', $2, 'intrus', 'app')",
      () => [f.workspaceA, t.taskA],
    ],
    [
      "un tag",
      "insert into tags (workspace_id, name) values ($1, 'intrus')",
      () => [f.workspaceA],
    ],
    [
      "un lien entre une tâche et un tag de A",
      "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3)",
      () => [f.workspaceA, t.trashedTaskA, t.tagA],
    ],
  ])(
    "l'utilisateur de B ne peut pas insérer %s dans A",
    async (_label, sql, params) => {
      const insert = asUser(f.userB, (db) => db.query(sql, params()));

      await expect(insert).rejects.toMatchObject({
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it.each([
    [
      "une sous-tâche de B rattachée à une tâche de A",
      "insert into tasks (workspace_id, side, parent_id, title, origin) values ($1, 'private', $2, 'intrus', 'app')",
      () => [f.workspaceB, t.taskA],
    ],
    [
      "une tâche de B dans un espace de A",
      "insert into tasks (workspace_id, side, context_id, title, origin) values ($1, 'private', $2, 'intrus', 'app')",
      () => [f.workspaceB, f.contextA],
    ],
    [
      "un lien de B vers une tâche de A",
      "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3)",
      () => [f.workspaceB, t.trashedTaskA, t.tagB],
    ],
    [
      "un lien de B vers un tag de A",
      "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3)",
      () => [f.workspaceB, t.subtaskB, t.tagA],
    ],
  ])("refuse %s (clé étrangère composite)", async (_label, sql, params) => {
    const insert = asUser(f.userB, (db) => db.query(sql, params()));

    await expect(insert).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it.each([
    ["DO NOTHING", "do nothing"],
    ["DO UPDATE", "do update set name = excluded.name"],
  ])(
    "INSERT … ON CONFLICT %s d'un tag avec le workspace_id de A est refusé et ne révèle pas si le nom existe",
    async (_label, action) => {
      const attempt = (name: string) =>
        asUser(f.userB, (db) =>
          db.query(
            `insert into tags (workspace_id, name) values ($1, $2)
             on conflict (workspace_id, lower(name)) ${action}`,
            [f.workspaceA, name],
          ),
        ).catch((error) => error.code);

      const codes = await Promise.all([
        attempt(`tag-A-${f.run}`),
        attempt(`absent-${f.run}`),
      ]);

      expect(codes).toEqual([INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE]);
    },
  );
});

describe("isolation de tasks, tags, task_tags : modification et suppression", () => {
  it.each([
    [
      "renommer une tâche",
      "update tasks set title = 'piraté' where id = $1",
      t.taskA,
    ],
    [
      "cocher une tâche",
      "update tasks set status_category = 'completed', completed_at = now() where id = $1",
      t.subtaskA,
    ],
    [
      "mettre une tâche à la corbeille",
      "update tasks set deleted_at = now() where id = $1",
      t.taskA,
    ],
    [
      "restaurer une tâche de la corbeille",
      "update tasks set deleted_at = null where id = $1",
      t.trashedTaskA,
    ],
    [
      "vider l'espace d'une tâche",
      "update tasks set context_id = null where id = $1",
      t.taskA,
    ],
    [
      "renommer un tag",
      "update tags set name = 'piraté' where id = $1",
      t.tagA,
    ],
    [
      "retirer un tag d'une tâche",
      "delete from task_tags where task_id = $1",
      t.taskA,
    ],
  ])("l'utilisateur de B ne peut pas %s de A", async (_label, sql, id) => {
    const affected = await asUser(f.userB, (db) => rowCount(db, sql, [id]));

    expect(affected).toBe(0);
  });

  it.each([
    [
      "tasks",
      "update tasks set title = 'piraté' where id = $1 returning *",
      t.taskA,
    ],
    [
      "tags",
      "update tags set name = 'piraté' where id = $1 returning *",
      t.tagA,
    ],
    [
      "task_tags",
      "delete from task_tags where tag_id = $1 returning *",
      t.tagA,
    ],
  ])(
    "… RETURNING sur une ligne de A (%s) ne renvoie rien à l'utilisateur de B",
    async (_label, sql, id) => {
      const rows = await asUser(
        f.userB,
        async (db) => (await db.query(sql, [id])).rows,
      );

      expect(rows).toEqual([]);
    },
  );

  it.each([
    [
      "une tâche",
      "update tasks set workspace_id = $1 where id = $2",
      () => [f.workspaceA, t.taskB],
    ],
    [
      "un tag",
      "update tags set workspace_id = $1 where id = $2",
      () => [f.workspaceA, t.tagB],
    ],
    [
      "un lien",
      "update task_tags set workspace_id = $1 where task_id = $2",
      () => [f.workspaceA, t.taskB],
    ],
  ])(
    "l'utilisateur de B ne peut pas déplacer %s de B vers A",
    async (_label, sql, params) => {
      const move = asUser(f.userB, (db) => db.query(sql, params()));

      await expect(move).rejects.toMatchObject({
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it("les lignes de A sont intactes après les tentatives de B", async () => {
    const rows = await owner.query(
      `select
         (select title from tasks where id = $1) as title,
         (select deleted_at is null from tasks where id = $1) as alive,
         (select deleted_at is not null from tasks where id = $2) as trashed,
         (select count(*)::int from task_tags where task_id = $1) as links`,
      [t.taskA, t.trashedTaskA],
    );

    expect(rows.rows[0]).toEqual({
      title: "Payer la crèche",
      alive: true,
      trashed: true,
      links: 1,
    });
  });
});

describe("limite documentée : espace de la sous-tâche non lié à celui de la parente", () => {
  // La FK parente porte (workspace_id, parent_id, side), pas context_id : en SQL direct, une
  // sous-tâche peut avoir un autre espace que sa parente (même workspace, même côté). Aucune fuite
  // entre workspaces. C'est mutations.ts (tâche 6) qui aligne l'espace de la sous-tâche sur la parente.

  /** Dans A : un second espace privé, et une sous-tâche de taskA (espace contextA) rangée dedans. */
  async function insertDivergentSubtask(db: PoolClient) {
    const otherContext = (
      await db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, $2, 'private') returning id",
        [f.workspaceA, `autre-${f.run}`],
      )
    ).rows[0].id as string;
    await db.query(
      "insert into tasks (workspace_id, side, context_id, parent_id, title, origin) values ($1, 'private', $2, $3, 'écart', 'app')",
      [f.workspaceA, otherContext, t.taskA],
    );
    return otherContext;
  }

  it("une sous-tâche dans un autre espace que sa parente est acceptée par la base", async () => {
    const inserted = await asUser(f.userA, async (db) => {
      await insertDivergentSubtask(db);
      return countByWorkspace(db, "tasks", [f.workspaceA]);
    });

    expect(inserted).toBe(4);
  });

  it("dans cet état, changer le type de l'espace de la parente échoue (23503)", async () => {
    // ON UPDATE CASCADE fait passer la parente côté pro ; la sous-tâche, restée dans un espace
    // privé, garde le côté privé et sa FK parente (ON UPDATE NO ACTION) bloque la cascade.
    const change = asUser(f.userA, async (db) => {
      await insertDivergentSubtask(db);
      return db.query("update contexts set kind = 'pro' where id = $1", [
        f.contextA,
      ]);
    });

    await expect(change).rejects.toMatchObject({
      code: FOREIGN_KEY_VIOLATION,
    });
  });
});
