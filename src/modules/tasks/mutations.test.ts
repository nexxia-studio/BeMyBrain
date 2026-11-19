// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertContexts,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import {
  insertTags,
  insertTasks,
  insertTasksFixture,
  newTasksFixture,
} from "../../../tests/factories/tasks";
import { TaskError, type TaskErrorCode } from "./errors";
import { completeTask, createTask, updateTask } from "./mutations";

// Écritures du module tasks contre la branche Neon test : withUserDb réel en rôle app_backend (RLS et droits
// de colonne actifs), fixture préparée et relue par le propriétaire (il voit aussi la corbeille).

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/mutations.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();
const t = newTasksFixture();

// Espaces ajoutés dans A (contextA, privé, vient de la fixture).
const names = {
  perso: `perso-${f.run}`,
  pro: `pro-${f.run}`,
  pro2: `pro2-${f.run}`,
  contextA: `ctx-A-${f.run}`,
  contextB: `ctx-B-${f.run}`,
};
const contextIds: Record<string, string> = {};

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertTasksFixture(owner, f, t);
  await insertContexts(owner, f.workspaceA, [
    { name: names.perso, kind: "private", position: 1 },
    { name: names.pro, kind: "pro", position: 0 },
    { name: names.pro2, kind: "pro", position: 1 },
  ]);
  const { rows } = await owner.query<{ id: string; name: string }>(
    "select id, name from contexts where workspace_id = $1",
    [f.workspaceA],
  );
  for (const row of rows) contextIds[row.name] = row.id;
  await insertTags(owner, f.workspaceA, ["Client"]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

type Row = {
  id: string;
  side: string;
  context_id: string | null;
  parent_id: string | null;
  title: string;
  notes: string | null;
  status_category: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  completed_at: Date | null;
  origin: string;
  created_by: string;
  deleted_at: Date | null;
};

async function rowOf(id: string): Promise<Row> {
  const { rows } = await owner.query<Row>(
    "select *, due_date::text as due_date from tasks where id = $1",
    [id],
  );
  return rows[0];
}

async function tagsOf(id: string): Promise<string[]> {
  const { rows } = await owner.query<{ name: string }>(
    `select tg.name from task_tags tt join tags tg on tg.id = tt.tag_id
     where tt.task_id = $1 order by lower(tg.name)`,
    [id],
  );
  return rows.map((r) => r.name);
}

function asA<T>(fn: Parameters<typeof db.asUser<T>>[1]): Promise<T> {
  return db.asUser(f.userA, fn);
}

async function expectCode(promise: Promise<unknown>, code: TaskErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(TaskError);
  expect((error as TaskError).code).toBe(code);
}

/** Parente privée dans contextA avec une sous-tâche active et une à la corbeille. */
async function familyInA() {
  const [parent] = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "Parente", contextId: f.contextA },
  ]);
  const [active, trashed] = await insertTasks(owner, f.workspaceA, f.userA, [
    {
      side: "private",
      title: "Sous active",
      parentId: parent,
      contextId: f.contextA,
    },
    {
      side: "private",
      title: "Sous jetée",
      parentId: parent,
      contextId: f.contextA,
      deletedAt: "2026-11-18T10:00:00Z",
    },
  ]);
  return { parent, active, trashed };
}

describe("createTask", () => {
  it("titre et côté seuls : valeurs par défaut, origine du contexte serveur, créateur posé par la base", async () => {
    const task = await asA((tx) =>
      createTask(
        f.workspaceA,
        { title: "  Acheter des ampoules ", side: "private" },
        "palette",
        tx,
      ),
    );

    expect(task).toMatchObject({
      title: "Acheter des ampoules",
      side: "private",
      contextId: null,
      parentId: null,
      statusCategory: "unstarted",
      priority: 0,
      dueDate: null,
      tags: [],
      subtasks: [],
    });
    const row = await rowOf(task.id);
    expect(row).toMatchObject({
      origin: "palette",
      created_by: f.userA,
      completed_at: null,
    });
  });

  it("espace par son nom : côté pris de l'espace ; échéance, priorité, tags créés à la volée sans doublon", async () => {
    const task = await asA((tx) =>
      createTask(
        f.workspaceA,
        {
          title: "Relancer le devis",
          context: names.pro,
          dueDate: "2026-11-20",
          dueTime: "14:00",
          priority: 2,
          tags: ["client", "Neuf", "neuf"],
        },
        "app",
        tx,
      ),
    );

    expect(task).toMatchObject({
      side: "pro",
      contextId: contextIds[names.pro],
      dueDate: "2026-11-20",
      dueTime: "14:00",
      priority: 2,
    });
    expect(await tagsOf(task.id)).toEqual(["Client", "Neuf"]);
    const { rows } = await owner.query(
      "select name from tags where workspace_id = $1 and lower(name) in ('client', 'neuf')",
      [f.workspaceA],
    );
    expect(rows).toHaveLength(2);
  });

  it("catégorie terminée à la création : completed_at posé", async () => {
    const task = await asA((tx) =>
      createTask(
        f.workspaceA,
        { title: "Déjà fait", side: "pro", statusCategory: "completed" },
        "app",
        tx,
      ),
    );

    expect((await rowOf(task.id)).completed_at).toBeInstanceOf(Date);
  });

  it.each([
    ["inconnu", () => `inconnu-${f.run}`, undefined],
    ["d'un autre workspace", () => names.contextB, undefined],
    ["de l'autre côté que celui demandé", () => names.pro, "private" as const],
  ])("espace %s → context_not_found", async (_label, context, side) => {
    await expectCode(
      asA((tx) =>
        createTask(
          f.workspaceA,
          { title: "x", context: context(), side },
          "app",
          tx,
        ),
      ),
      "context_not_found",
    );
  });

  it.each([
    ["sans côté, sans espace, sans parente", { title: "x" }],
    ["heure sans date", { title: "x", side: "pro", dueTime: "10:00" }],
    ["clé inconnue", { title: "x", side: "pro", workspaceId: f.workspaceB }],
    ["titre vide", { title: "   ", side: "pro" }],
  ])("%s → invalid_params", async (_label, input) => {
    await expectCode(
      asA((tx) => createTask(f.workspaceA, input as never, "app", tx)),
      "invalid_params",
    );
  });

  it("origine hors liste → invalid_params", async () => {
    await expectCode(
      asA((tx) =>
        createTask(
          f.workspaceA,
          { title: "x", side: "pro" },
          "whatsapp" as never,
          tx,
        ),
      ),
      "invalid_params",
    );
  });

  it("sous-tâche sans côté ni espace hérite de la parente", async () => {
    const sub = await asA((tx) =>
      createTask(
        f.workspaceA,
        { title: "Virement 2", parentId: t.taskA },
        "app",
        tx,
      ),
    );

    expect(sub).toMatchObject({
      parentId: t.taskA,
      side: "private",
      contextId: f.contextA,
    });
  });

  it.each([
    ["un côté", { side: "private" as const }],
    ["un espace", { context: names.perso }],
  ])(
    "sous-tâche créée avec %s → subtask_follows_parent",
    async (_label, extra) => {
      await expectCode(
        asA((tx) =>
          createTask(
            f.workspaceA,
            { title: "x", parentId: t.taskA, ...extra },
            "app",
            tx,
          ),
        ),
        "subtask_follows_parent",
      );
    },
  );

  it("sous-tâche de sous-tâche → subtask_depth", async () => {
    await expectCode(
      asA((tx) =>
        createTask(
          f.workspaceA,
          { title: "x", parentId: t.subtaskA },
          "app",
          tx,
        ),
      ),
      "subtask_depth",
    );
  });

  it("parente à la corbeille → parent_in_trash", async () => {
    await expectCode(
      asA((tx) =>
        createTask(
          f.workspaceA,
          { title: "x", parentId: t.trashedTaskA },
          "app",
          tx,
        ),
      ),
      "parent_in_trash",
    );
  });

  it("parente d'un autre workspace → not_found, rien d'écrit chez B", async () => {
    await expectCode(
      asA((tx) =>
        createTask(
          f.workspaceA,
          { title: "intrus", parentId: t.taskB },
          "app",
          tx,
        ),
      ),
      "not_found",
    );
    const { rows } = await owner.query(
      "select 1 from tasks where title = 'intrus'",
    );
    expect(rows).toHaveLength(0);
  });

  it("workspace dont l'utilisateur n'est pas membre : refusé par la RLS (42501), rien d'écrit", async () => {
    const attempt = asA((tx) =>
      createTask(f.workspaceB, { title: "intrus B", side: "pro" }, "app", tx),
    );

    // DatabaseError (src/db/user-db.ts) n'est pas importable depuis src/modules (frontière eslint) : reconnue
    // par son nom, fixé en dur dans la classe.
    await expect(attempt).rejects.toMatchObject({
      name: "DatabaseError",
      code: "42501",
    });
    const { rows } = await owner.query(
      "select 1 from tasks where title = 'intrus B'",
    );
    expect(rows).toHaveLength(0);
  });
});

describe("updateTask : côté et espace", () => {
  it("changer l'espace de la parente suit sur ses sous-tâches, corbeille comprise", async () => {
    const { parent, active, trashed } = await familyInA();

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: parent, context: names.pro }, tx),
    );

    for (const id of [parent, active, trashed]) {
      expect(await rowOf(id)).toMatchObject({
        side: "pro",
        context_id: contextIds[names.pro],
      });
    }
  });

  it("après ce changement, changer le type de l'espace passe (pas de 23503) et entraîne toute la famille", async () => {
    const { parent, active, trashed } = await familyInA();
    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: parent, context: names.perso }, tx),
    );

    await asA((tx) =>
      tx.execute(
        sql`update contexts set kind = 'pro' where id = ${contextIds[names.perso]}`,
      ),
    );

    for (const id of [parent, active, trashed]) {
      expect(await rowOf(id)).toMatchObject({
        side: "pro",
        context_id: contextIds[names.perso],
      });
    }
  });

  it("changer le côté seul de la parente : sans espace, sous-tâches suivies, corbeille comprise", async () => {
    const { parent, active, trashed } = await familyInA();

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: parent, side: "pro" }, tx),
    );

    for (const id of [parent, active, trashed]) {
      expect(await rowOf(id)).toMatchObject({ side: "pro", context_id: null });
    }
  });

  it("retirer l'espace (null) : côté gardé, sous-tâches suivies", async () => {
    const { parent, active, trashed } = await familyInA();

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: parent, context: null }, tx),
    );

    for (const id of [parent, active, trashed]) {
      expect(await rowOf(id)).toMatchObject({
        side: "private",
        context_id: null,
      });
    }
  });

  it("espace d'un autre côté que le côté demandé → context_not_found, rien de changé", async () => {
    const { parent } = await familyInA();

    await expectCode(
      asA((tx) =>
        updateTask(
          f.workspaceA,
          { taskId: parent, side: "private", context: names.pro2 },
          tx,
        ),
      ),
      "context_not_found",
    );
    expect(await rowOf(parent)).toMatchObject({
      side: "private",
      context_id: f.contextA,
    });
  });

  it.each([
    ["un côté", { side: "pro" as const }],
    ["un espace", { context: names.perso }],
    ["un espace vide", { context: null }],
  ])(
    "update d'une sous-tâche avec %s → subtask_follows_parent",
    async (_label, extra) => {
      const { active } = await familyInA();

      await expectCode(
        asA((tx) => updateTask(f.workspaceA, { taskId: active, ...extra }, tx)),
        "subtask_follows_parent",
      );
    },
  );

  it("update d'une sous-tâche sans côté ni espace : accepté", async () => {
    const { active } = await familyInA();

    const task = await asA((tx) =>
      updateTask(f.workspaceA, { taskId: active, title: "Renommée" }, tx),
    );

    expect(task).toMatchObject({ title: "Renommée", side: "private" });
  });
});

describe("updateTask : champs", () => {
  it("titre, notes, priorité, échéance ; null retire notes et échéance (heure comprise)", async () => {
    const [id] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Avant" },
    ]);

    const first = await asA((tx) =>
      updateTask(
        f.workspaceA,
        {
          taskId: id,
          title: "Après",
          notes: "note",
          priority: 1,
          dueDate: "2026-12-01",
          dueTime: "09:30",
        },
        tx,
      ),
    );
    expect(first).toMatchObject({
      title: "Après",
      notes: "note",
      priority: 1,
      dueDate: "2026-12-01",
      dueTime: "09:30",
    });

    const second = await asA((tx) =>
      updateTask(f.workspaceA, { taskId: id, notes: null, dueDate: null }, tx),
    );
    expect(second).toMatchObject({ notes: null, dueDate: null, dueTime: null });
  });

  it("heure sur une tâche sans date → invalid_params", async () => {
    const [id] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Sans date" },
    ]);

    await expectCode(
      asA((tx) =>
        updateTask(f.workspaceA, { taskId: id, dueTime: "10:00" }, tx),
      ),
      "invalid_params",
    );
  });

  it("completed_at posé à completed puis canceled, vidé au retour à une catégorie ouverte", async () => {
    const [id] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Cycle" },
    ]);
    const update = (statusCategory: "completed" | "canceled" | "started") =>
      asA((tx) => updateTask(f.workspaceA, { taskId: id, statusCategory }, tx));

    await update("completed");
    const completedAt = (await rowOf(id)).completed_at;
    expect(completedAt).toBeInstanceOf(Date);

    await update("canceled");
    expect((await rowOf(id)).completed_at).toEqual(completedAt);

    await update("started");
    expect((await rowOf(id)).completed_at).toBeNull();

    await update("canceled");
    expect((await rowOf(id)).completed_at).toBeInstanceOf(Date);
  });

  it("aucun champ → invalid_params", async () => {
    await expectCode(
      asA((tx) => updateTask(f.workspaceA, { taskId: t.taskA }, tx)),
      "invalid_params",
    );
  });
});

describe("updateTask : tags", () => {
  it("addTags garde l'existant ; removeTags retire seulement le nom donné ; un nom absent n'est pas une erreur", async () => {
    const [id] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Taguée", tags: ["Client"] },
    ]);

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: id, addTags: ["a", "b"] }, tx),
    );
    expect(await tagsOf(id)).toEqual(["a", "b", "Client"]);

    const task = await asA((tx) =>
      updateTask(
        f.workspaceA,
        { taskId: id, removeTags: ["B", `absent-${f.run}`] },
        tx,
      ),
    );
    expect(task.tags).toEqual(["a", "Client"]);
  });

  it("ajouter un tag déjà porté : aucun doublon", async () => {
    const [id] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Déjà taguée", tags: ["Client"] },
    ]);

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: id, addTags: ["CLIENT"] }, tx),
    );

    expect(await tagsOf(id)).toEqual(["Client"]);
  });

  it("même nom dans addTags et removeTags (casse différente) → invalid_params", async () => {
    await expectCode(
      asA((tx) =>
        updateTask(
          f.workspaceA,
          { taskId: t.taskA, addTags: ["urgent"], removeTags: ["Urgent"] },
          tx,
        ),
      ),
      "invalid_params",
    );
  });

  it("removeTags ne touche pas le tag d'une autre tâche", async () => {
    const [one, two] = await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "pro", title: "Une", tags: ["Client"] },
      { side: "pro", title: "Deux", tags: ["Client"] },
    ]);

    await asA((tx) =>
      updateTask(f.workspaceA, { taskId: one, removeTags: ["client"] }, tx),
    );

    expect(await tagsOf(one)).toEqual([]);
    expect(await tagsOf(two)).toEqual(["Client"]);
  });
});

describe("tâche introuvable", () => {
  it("tâche à la corbeille : update et complete → not_found, rien de changé", async () => {
    await expectCode(
      asA((tx) =>
        updateTask(
          f.workspaceA,
          { taskId: t.trashedTaskA, title: "touchée" },
          tx,
        ),
      ),
      "not_found",
    );
    await expectCode(
      asA((tx) => completeTask(f.workspaceA, t.trashedTaskA, tx)),
      "not_found",
    );
    expect(await rowOf(t.trashedTaskA)).toMatchObject({
      title: "Ancienne tâche",
      status_category: "unstarted",
    });
  });

  it("tâche de B, avec le workspace de A ou celui de B → not_found, B inchangée", async () => {
    for (const workspace of [f.workspaceA, f.workspaceB]) {
      await expectCode(
        asA((tx) =>
          updateTask(
            workspace,
            { taskId: t.taskB, title: "volée", addTags: ["x"] },
            tx,
          ),
        ),
        "not_found",
      );
      await expectCode(
        asA((tx) => completeTask(workspace, t.taskB, tx)),
        "not_found",
      );
    }
    expect(await rowOf(t.taskB)).toMatchObject({
      title: "Relancer le devis",
      status_category: "unstarted",
    });
    expect(await tagsOf(t.taskB)).toEqual([`tag-B-${f.run}`]);
  });
});

describe("completeTask", () => {
  it("cocher la parente la passe à completed sans toucher ses sous-tâches", async () => {
    const { parent, active } = await familyInA();

    const task = await asA((tx) => completeTask(f.workspaceA, parent, tx));

    expect(task.statusCategory).toBe("completed");
    expect((await rowOf(parent)).completed_at).toBeInstanceOf(Date);
    expect(await rowOf(active)).toMatchObject({
      status_category: "unstarted",
      completed_at: null,
    });
  });
});
