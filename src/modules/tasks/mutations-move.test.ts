// @vitest-environment node
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
import { insertTasks, type TaskRow } from "../../../tests/factories/tasks";
import { TaskError, type TaskErrorCode } from "./errors";
import {
  completeTask,
  createTask,
  moveTask,
  moveTaskToTrash,
  restoreTask,
  updateTask,
} from "./mutations";

// Ordre du tableau (moveTask, puis arrivées hors dépôt) contre la branche Neon test : withUserDb réel en rôle app_backend (RLS et droits de colonne
// actifs), fixture préparée et relue par le propriétaire. L'ordre d'une colonne se lit ici en SQL
// (`order by sort_key`), jamais par une fonction du module. Chaque test repart de workspaces sans tâche :
// l'ordre est global par workspace et par catégorie.

// Même délai que mutations.test.ts : plusieurs allers-retours Neon séquentiels par test.
vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/mutations-move.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
});

beforeEach(async () => {
  await owner.query("delete from tasks where workspace_id = any($1)", [
    [f.workspaceA, f.workspaceB],
  ]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

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

type Seed = Omit<TaskRow, "side"> & {
  side?: TaskRow["side"];
  sortKey?: string;
  completedAt?: string;
};

/** Tâches privées et « À faire » par défaut, avec clé d'ordre et date de clôture posées par le propriétaire. */
async function seed(
  rows: Seed[],
  workspace = f.workspaceA,
  user = f.userA,
): Promise<string[]> {
  const ids = await insertTasks(
    owner,
    workspace,
    user,
    rows.map((row) => ({ side: "private", ...row })),
  );
  for (const [index, row] of rows.entries()) {
    if (row.sortKey === undefined && row.completedAt === undefined) continue;
    await owner.query(
      "update tasks set sort_key = $2, completed_at = $3, updated_at = null where id = $1",
      [ids[index], row.sortKey ?? null, row.completedAt ?? null],
    );
  }
  return ids;
}

const TRASHED = { title: "Jetée", deletedAt: "2026-11-18T10:00:00Z" };

/** Colonne « À faire » ordonnée a, b, c, une tâche à la corbeille entre a et b, et une carte m ailleurs. */
async function orderedColumn() {
  const [a, b, c, trashed, m] = await seed([
    { title: "a", sortKey: "B" },
    { title: "b", sortKey: "V" },
    { title: "c", sortKey: "j" },
    { ...TRASHED, sortKey: "N" },
    { title: "m", statusCategory: "backlog" },
  ]);
  return { a, b, c, trashed, m } as Record<string, string>;
}

/** Tâches actives d'une colonne, dans l'ordre de leur clé (sans-clé à la fin). */
async function columnOf(
  statusCategory: string,
  workspace = f.workspaceA,
): Promise<string[]> {
  const { rows } = await owner.query<{ id: string }>(
    `select id from tasks
     where workspace_id = $1 and status_category = $2 and deleted_at is null
     order by sort_key asc nulls last, id`,
    [workspace, statusCategory],
  );
  return rows.map((row) => row.id);
}

type Snapshot = {
  id: string;
  status_category: string;
  sort_key: string | null;
  parent_id: string | null;
  completed_at: string | null;
  deleted_at: string | null;
  updated_at: string | null;
};

/** État des lignes, `updated_at` compris : toute réécriture d'une ligne se voit (trigger). */
async function snapshot(ids: string[]): Promise<Snapshot[]> {
  const { rows } = await owner.query<Snapshot>(
    `select id, status_category, sort_key, parent_id, completed_at::text, deleted_at::text, updated_at::text
     from tasks where id = any($1) order by id`,
    [ids],
  );
  return rows;
}

async function one(id: string): Promise<Snapshot> {
  return (await snapshot([id]))[0]!;
}

function move(input: Parameters<typeof moveTask>[1], workspace = f.workspaceA) {
  return asA((tx) => moveTask(workspace, input, tx));
}

/** Attend qu'une transaction patiente sur un verrou consultatif de cette base (lu par le propriétaire). */
async function waitForBlockedAdvisoryLock(): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const { rows } = await owner.query<{ waiting: number }>(
      `select count(*)::int as waiting from pg_locks
       where locktype = 'advisory' and not granted
         and database = (select oid from pg_database where datname = current_database())`,
    );
    if (rows[0]!.waiting > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

describe("moveTask : place dans une colonne ouverte déjà ordonnée", () => {
  it("entre deux voisines : la carte prend la catégorie et se range entre elles", async () => {
    const { a, b, c, m } = await orderedColumn();

    const detail = await move({
      taskId: m,
      statusCategory: "unstarted",
      beforeId: a,
      afterId: b,
    });

    expect(await columnOf("unstarted")).toEqual([a, m, b, c]);
    expect(detail).toMatchObject({ id: m, statusCategory: "unstarted" });
    expect(detail).not.toHaveProperty("sortKey");
  });

  it("sans voisine : en tête de colonne", async () => {
    const { a, b, c, m } = await orderedColumn();

    await move({ taskId: m, statusCategory: "unstarted" });

    expect(await columnOf("unstarted")).toEqual([m, a, b, c]);
  });

  it("beforeId seul sur la dernière carte : en queue", async () => {
    const { a, b, c, m } = await orderedColumn();

    await move({ taskId: m, statusCategory: "unstarted", beforeId: c });

    expect(await columnOf("unstarted")).toEqual([a, b, c, m]);
  });

  it("afterId seul : juste avant cette carte", async () => {
    const { a, b, c, m } = await orderedColumn();

    await move({ taskId: m, statusCategory: "unstarted", afterId: b });

    expect(await columnOf("unstarted")).toEqual([a, m, b, c]);
  });

  it("afterId périmé (une carte s'est glissée entre les deux) : juste après beforeId, avant la carte réellement suivante", async () => {
    const { a, b, c, m } = await orderedColumn();

    await move({
      taskId: m,
      statusCategory: "unstarted",
      beforeId: a,
      afterId: c,
    });

    expect(await columnOf("unstarted")).toEqual([a, m, b, c]);
  });

  it("ne réécrit aucune autre ligne, corbeille comprise", async () => {
    const { a, b, c, trashed, m } = await orderedColumn();
    const others = [a, b, c, trashed];
    const before = await snapshot(others);

    await move({
      taskId: m,
      statusCategory: "unstarted",
      beforeId: a,
      afterId: b,
    });

    expect(await snapshot(others)).toEqual(before);
  });

  it("déplacement sur place entre les mêmes voisines : rien n'est écrit", async () => {
    const { a, b, c, trashed } = await orderedColumn();
    const all = [a, b, c, trashed];
    const before = await snapshot(all);

    const detail = await move({
      taskId: b,
      statusCategory: "unstarted",
      beforeId: a,
      afterId: c,
    });

    expect(await snapshot(all)).toEqual(before);
    expect(detail.id).toBe(b);
  });

  it("déplacement sur place en tête : rien n'est écrit", async () => {
    const { a, b, c, trashed } = await orderedColumn();
    const all = [a, b, c, trashed];
    const before = await snapshot(all);

    await move({ taskId: a, statusCategory: "unstarted", afterId: b });

    expect(await snapshot(all)).toEqual(before);
  });

  it("dans sa propre colonne : change seulement de place", async () => {
    const { a, b, c } = await orderedColumn();

    await move({ taskId: c, statusCategory: "unstarted", beforeId: a });

    expect(await columnOf("unstarted")).toEqual([a, c, b]);
  });
});

describe("moveTask : voisines périmées", () => {
  it("voisine à la corbeille : en tête de colonne, sans erreur", async () => {
    const { a, b, c, trashed, m } = await orderedColumn();

    await move({ taskId: m, statusCategory: "unstarted", beforeId: trashed });

    expect(await columnOf("unstarted")).toEqual([m, a, b, c]);
  });

  it("voisine d'une autre catégorie, seule : en tête de colonne", async () => {
    const { a, b, c, m } = await orderedColumn();
    const [elsewhere] = await seed([
      { title: "En cours", statusCategory: "started", sortKey: "c" },
    ]);

    await move({ taskId: m, statusCategory: "unstarted", beforeId: elsewhere });

    expect(await columnOf("unstarted")).toEqual([m, a, b, c]);
  });

  it("beforeId d'une autre catégorie, afterId valable : juste avant afterId", async () => {
    const { a, b, c, m } = await orderedColumn();
    const [elsewhere] = await seed([
      { title: "En cours", statusCategory: "started", sortKey: "C" },
    ]);

    await move({
      taskId: m,
      statusCategory: "unstarted",
      beforeId: elsewhere,
      afterId: c,
    });

    expect(await columnOf("unstarted")).toEqual([a, b, m, c]);
  });

  it("voisine inconnue : en tête de colonne", async () => {
    const { a, b, c, m } = await orderedColumn();

    await move({
      taskId: m,
      statusCategory: "unstarted",
      beforeId: "00000000-0000-4000-8000-000000000000",
    });

    expect(await columnOf("unstarted")).toEqual([m, a, b, c]);
  });
});

describe("moveTask : colonne sans clés", () => {
  it("donne une clé à toute la colonne dans l'ordre affiché (clés, puis ordre de la liste), sous-tâches et autres côtés compris, puis place la carte", async () => {
    const [keyed, due, parent, low, trashed, m] = await seed([
      { title: "Déjà placée", sortKey: "V" },
      { title: "Échéance", dueDate: "2026-12-01" },
      { title: "Urgente", priority: 1 },
      { title: "Pro sans priorité", side: "pro" },
      TRASHED,
      { title: "m", statusCategory: "started" },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche", parentId: parent, dueDate: "2026-11-30" },
    ]);

    await move({ taskId: m, statusCategory: "unstarted", beforeId: due });

    expect(await columnOf("unstarted")).toEqual([
      keyed,
      sub,
      due,
      m,
      parent,
      low,
    ]);
    const rows = await snapshot([keyed, sub, due, m, parent, low]);
    expect(rows.every((row) => row.sort_key !== null)).toBe(true);
    expect(new Set(rows.map((row) => row.sort_key)).size).toBe(6);
    expect((await one(trashed!)).sort_key).toBeNull();
  });

  it("la carte sans clé de sa propre colonne se place parmi les autres", async () => {
    const [first, second, m] = await seed([
      { title: "Échéance", dueDate: "2026-12-01" },
      { title: "Sans échéance" },
      { title: "m", dueDate: "2026-11-01" },
      TRASHED,
    ]);

    await move({ taskId: m, statusCategory: "unstarted", beforeId: second });

    expect(await columnOf("unstarted")).toEqual([first, second, m]);
  });

  it("seule tâche sans clé de sa colonne : les autres ne sont pas réécrites", async () => {
    const [a, b, m, trashed] = await seed([
      { title: "a", sortKey: "B" },
      { title: "b", sortKey: "V" },
      { title: "m" },
      TRASHED,
    ]);
    const before = await snapshot([a, b, trashed] as string[]);

    await move({ taskId: m, statusCategory: "unstarted", beforeId: a });

    expect(await columnOf("unstarted")).toEqual([a, m, b]);
    expect(await snapshot([a, b, trashed] as string[])).toEqual(before);
  });
});

describe("moveTask : Terminée et Annulée", () => {
  it.each(["completed", "canceled"] as const)(
    "vers %s : date posée, clé vidée, position ignorée",
    async (statusCategory) => {
      const { a, b } = await orderedColumn();
      const [closed] = await seed([
        { ...TRASHED, statusCategory, sortKey: "V" },
        {
          title: "Déjà là",
          statusCategory,
          completedAt: "2026-11-01T10:00:00Z",
        },
      ]);

      const detail = await move({ taskId: a, statusCategory, beforeId: b });

      const row = await one(a);
      expect(row.status_category).toBe(statusCategory);
      expect(row.completed_at).not.toBeNull();
      expect(row.sort_key).toBeNull();
      expect(detail.completedAt).toBeInstanceOf(Date);
      expect((await one(closed!)).sort_key).toBe("V");
    },
  );

  it("de Terminée à Annulée : la date de clôture est gardée", async () => {
    const [done] = await seed([
      {
        title: "Terminée",
        statusCategory: "completed",
        completedAt: "2026-11-01T10:00:00Z",
      },
      { ...TRASHED, statusCategory: "canceled" },
    ]);
    const before = (await one(done!)).completed_at;

    await move({ taskId: done!, statusCategory: "canceled" });

    const row = await one(done!);
    expect(row.status_category).toBe("canceled");
    expect(row.completed_at).toBe(before);
  });

  it("sortir de Terminée : date vidée, clé posée à la place demandée", async () => {
    const { a, b, c } = await orderedColumn();
    const [done] = await seed([
      {
        title: "Terminée",
        statusCategory: "completed",
        completedAt: "2026-11-01T10:00:00Z",
      },
    ]);

    const detail = await move({
      taskId: done!,
      statusCategory: "unstarted",
      beforeId: b,
    });

    const row = await one(done!);
    expect(row.completed_at).toBeNull();
    expect(row.sort_key).not.toBeNull();
    expect(detail.completedAt).toBeNull();
    expect(await columnOf("unstarted")).toEqual([a, b, done, c]);
  });
});

describe("moveTask : sous-tâche", () => {
  it("une sous-tâche se déplace comme une tâche, sa parente n'est pas réécrite", async () => {
    const [parent] = await seed([
      { title: "Parente", sortKey: "V" },
      { ...TRASHED, statusCategory: "started" },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche", parentId: parent, sortKey: "j" },
    ]);
    const before = await one(parent!);

    const detail = await move({ taskId: sub!, statusCategory: "started" });

    expect(await one(parent!)).toEqual(before);
    expect(await one(sub!)).toMatchObject({
      status_category: "started",
      parent_id: parent,
    });
    expect(detail.parentId).toBe(parent);
    expect(await columnOf("started")).toEqual([sub]);
  });
});

describe("moveTask : tâche introuvable et isolation", () => {
  it("tâche à la corbeille → not_found, rien de changé", async () => {
    const { trashed } = await orderedColumn();
    const before = await one(trashed!);

    await expectCode(
      move({ taskId: trashed!, statusCategory: "started" }),
      "not_found",
    );

    expect(await one(trashed!)).toEqual(before);
  });

  it("tâche d'un autre workspace, avec le workspace de A ou celui de B → not_found, B inchangée", async () => {
    await orderedColumn();
    const [taskB] = await seed(
      [{ title: "Tâche de B", side: "pro", sortKey: "V" }],
      f.workspaceB,
      f.userB,
    );
    const before = await one(taskB!);

    await expectCode(
      move({ taskId: taskB!, statusCategory: "started" }),
      "not_found",
    );
    await expectCode(
      move({ taskId: taskB!, statusCategory: "started" }, f.workspaceB),
      "not_found",
    );

    expect(await one(taskB!)).toEqual(before);
  });

  it("voisine d'un autre workspace : ignorée (tête de colonne), B inchangée, sa clé ne sert à rien", async () => {
    const { a, b, c, m } = await orderedColumn();
    const [taskB] = await seed(
      [{ title: "Tâche de B", side: "pro", sortKey: "b" }],
      f.workspaceB,
      f.userB,
    );
    const before = await one(taskB!);

    await move({ taskId: m, statusCategory: "unstarted", beforeId: taskB });

    expect(await columnOf("unstarted")).toEqual([m, a, b, c]);
    expect(await one(taskB!)).toEqual(before);
  });

  it("colonne sans clés de A normalisée : les tâches de B de la même catégorie restent sans clé", async () => {
    const [, m] = await seed([{ title: "Sans clé" }, { title: "m" }, TRASHED]);
    const [taskB] = await seed(
      [{ title: "Tâche de B", side: "pro" }],
      f.workspaceB,
      f.userB,
    );
    const before = await one(taskB!);

    await move({ taskId: m!, statusCategory: "unstarted" });

    expect(await one(taskB!)).toEqual(before);
  });
});

describe("moveTask : déplacements concurrents", () => {
  it("deux connexions, mêmes voisines : le second attend le premier, deux clés distinctes, ordre total", async () => {
    const [a, b, m1, m2] = await seed([
      { title: "a", sortKey: "B" },
      { title: "b", sortKey: "V" },
      { title: "m1", statusCategory: "backlog" },
      { title: "m2", statusCategory: "started" },
      TRASHED,
    ]);
    const input = {
      statusCategory: "unstarted",
      beforeId: a,
      afterId: b,
    } as const;
    let commitFirst = () => {};
    const gate = new Promise<void>((resolve) => (commitFirst = resolve));
    let firstMoved = () => {};
    const moved = new Promise<void>((resolve) => (firstMoved = resolve));

    // Première transaction : déplace, puis reste ouverte (non validée) jusqu'à l'ouverture de la porte.
    const first = asA(async (tx) => {
      await moveTask(f.workspaceA, { ...input, taskId: m1! }, tx);
      firstMoved();
      await gate;
    });
    let secondBlocked = false;
    let second: Promise<unknown> = Promise.resolve();
    try {
      await Promise.race([moved, first]);
      second = move({ ...input, taskId: m2! });
      second.catch(() => undefined);
      secondBlocked = await waitForBlockedAdvisoryLock();
    } finally {
      commitFirst();
    }
    await Promise.all([first, second]);

    expect(secondBlocked).toBe(true);
    const keys = (await snapshot([a, b, m1, m2] as string[])).map(
      (row) => row.sort_key,
    );
    expect(new Set(keys).size).toBe(4);
    // Le second, validé après le premier, se range juste après beforeId.
    expect(await columnOf("unstarted")).toEqual([a, m2, m1, b]);
  });
});

// Arrivées hors dépôt : création, changement de statut, réouverture, restauration.

function create(
  input: Parameters<typeof createTask>[1],
  workspace = f.workspaceA,
) {
  return asA((tx) => createTask(workspace, input, "app", tx));
}

function update(input: Parameters<typeof updateTask>[1]) {
  return asA((tx) => updateTask(f.workspaceA, input, tx));
}

function restore(taskId: string, workspace = f.workspaceA) {
  return asA((tx) => restoreTask(workspace, taskId, tx));
}

async function keysOf(ids: string[]): Promise<(string | null)[]> {
  return (await snapshot(ids)).map((row) => row.sort_key);
}

describe("createTask : place dans le tableau", () => {
  it("tâche créée dans une colonne ordonnée : première, sans clé dans le détail", async () => {
    const { a, b, c } = await orderedColumn();

    const detail = await create({ title: "Nouvelle", side: "private" });

    expect(await columnOf("unstarted")).toEqual([detail.id, a, b, c]);
    expect((await one(detail.id)).sort_key).not.toBeNull();
    expect(detail).not.toHaveProperty("sortKey");
  });

  it("ne réécrit aucune autre ligne de la colonne, corbeille comprise", async () => {
    const { a, b, c, trashed } = await orderedColumn();
    const others = [a, b, c, trashed];
    const before = await snapshot(others);

    await create({ title: "Nouvelle", side: "private" });

    expect(await snapshot(others)).toEqual(before);
  });

  it("tâche créée dans une colonne sans clé : sans clé, même si une tâche à la corbeille en porte une", async () => {
    const [other] = await seed([
      { title: "Sans clé" },
      { ...TRASHED, sortKey: "V" },
    ]);

    const detail = await create({ title: "Nouvelle", side: "private" });

    expect(await keysOf([detail.id, other!])).toEqual([null, null]);
  });

  it("tâche créée dans une autre colonne ouverte ordonnée : première de cette colonne", async () => {
    await orderedColumn();
    const [x] = await seed([
      { title: "x", statusCategory: "started", sortKey: "V" },
    ]);

    const detail = await create({
      title: "Nouvelle",
      side: "pro",
      statusCategory: "started",
    });

    expect(await columnOf("started")).toEqual([detail.id, x]);
  });

  it("tâche créée terminée : sans clé", async () => {
    await seed([
      { title: "Terminée", statusCategory: "completed", sortKey: "V" },
      { ...TRASHED, statusCategory: "completed" },
    ]);

    const detail = await create({
      title: "Déjà faite",
      side: "private",
      statusCategory: "completed",
    });

    expect((await one(detail.id)).sort_key).toBeNull();
  });

  it("sous-tâche créée : première de sa colonne, parente non réécrite", async () => {
    const { a, b, c } = await orderedColumn();
    const before = await one(a!);

    const detail = await create({ title: "Sous-tâche", parentId: a });

    expect(await columnOf("unstarted")).toEqual([detail.id, a, b, c]);
    expect(detail.parentId).toBe(a);
    expect(await one(a!)).toEqual(before);
  });
});

describe("updateTask et completeTask : place dans le tableau", () => {
  it("vers « En cours » ordonnée : première d'« En cours », la corbeille ne compte pas", async () => {
    const { a, b, c } = await orderedColumn();
    const [x] = await seed([
      { title: "x", statusCategory: "started", sortKey: "V" },
      { ...TRASHED, statusCategory: "started", sortKey: "B" },
    ]);

    const detail = await update({ taskId: c!, statusCategory: "started" });

    expect(await columnOf("started")).toEqual([c, x]);
    expect(await columnOf("unstarted")).toEqual([a, b]);
    expect(detail).not.toHaveProperty("sortKey");
  });

  it("vers une colonne ouverte sans clé : la clé est retirée", async () => {
    const { a } = await orderedColumn();
    await seed([
      { title: "Sans clé", statusCategory: "started" },
      { ...TRASHED, statusCategory: "started", sortKey: "V" },
    ]);

    await update({ taskId: a!, statusCategory: "started" });

    expect((await one(a!)).sort_key).toBeNull();
  });

  it("vers Terminée : clé vidée", async () => {
    const { a } = await orderedColumn();

    await update({ taskId: a!, statusCategory: "completed" });

    expect(await one(a!)).toMatchObject({
      status_category: "completed",
      sort_key: null,
    });
  });

  it("titre modifié : clé inchangée, aucune autre ligne réécrite", async () => {
    const { a, b, c, trashed } = await orderedColumn();
    const before = await snapshot([b, c, trashed] as string[]);

    await update({ taskId: a!, title: "Renommée" });

    expect((await one(a!)).sort_key).toBe("B");
    expect(await snapshot([b, c, trashed] as string[])).toEqual(before);
  });

  it("statut redonné à l'identique : clé inchangée", async () => {
    const { a, b, c } = await orderedColumn();

    await update({ taskId: b!, statusCategory: "unstarted", priority: 2 });

    expect(await columnOf("unstarted")).toEqual([a, b, c]);
    expect((await one(b!)).sort_key).toBe("V");
  });

  it("completeTask : clé vidée", async () => {
    const { b } = await orderedColumn();

    await asA((tx) => completeTask(f.workspaceA, b!, tx));

    expect(await one(b!)).toMatchObject({
      status_category: "completed",
      sort_key: null,
    });
  });

  it("tâche terminée réouverte : première de « À faire »", async () => {
    const { a, b, c } = await orderedColumn();
    const [done] = await seed([
      {
        title: "Terminée",
        statusCategory: "completed",
        completedAt: "2026-11-01T10:00:00Z",
      },
    ]);

    await update({ taskId: done!, statusCategory: "unstarted" });

    expect(await columnOf("unstarted")).toEqual([done, a, b, c]);
    expect((await one(done!)).completed_at).toBeNull();
  });
});

describe("restoreTask et moveTaskToTrash : place dans le tableau", () => {
  it("mise à la corbeille : la clé n'est pas réécrite", async () => {
    const { a, b, c } = await orderedColumn();

    await asA((tx) => moveTaskToTrash(f.workspaceA, b!, tx));

    expect((await one(b!)).sort_key).toBe("V");
    expect(await columnOf("unstarted")).toEqual([a, c]);
  });

  it("tâche restaurée dont l'ancienne clé est celle d'une autre : première de sa colonne, jamais deux clés égales", async () => {
    const [a, b, trashed] = await seed([
      { title: "a", sortKey: "B" },
      { title: "b", sortKey: "V" },
      { ...TRASHED, sortKey: "V" },
    ]);
    const before = await snapshot([a, b] as string[]);

    const detail = await restore(trashed!);

    expect(await columnOf("unstarted")).toEqual([trashed, a, b]);
    expect(new Set(await keysOf([a, b, trashed] as string[])).size).toBe(3);
    expect(await snapshot([a, b] as string[])).toEqual(before);
    expect(detail).not.toHaveProperty("sortKey");
  });

  it("tâche restaurée dans une colonne sans clé : son ancienne clé est retirée", async () => {
    const [, trashed] = await seed([
      { title: "Sans clé" },
      { ...TRASHED, sortKey: "V" },
      { ...TRASHED, title: "Autre jetée", sortKey: "j" },
    ]);

    await restore(trashed!);

    expect((await one(trashed!)).sort_key).toBeNull();
  });

  it("tâche terminée restaurée : sans clé", async () => {
    const [trashed] = await seed([
      { ...TRASHED, statusCategory: "completed", sortKey: "V" },
      { title: "Terminée", statusCategory: "completed", sortKey: "B" },
    ]);

    await restore(trashed!);

    expect(await one(trashed!)).toMatchObject({
      deleted_at: null,
      sort_key: null,
    });
  });

  it("parente restaurée avec deux sous-tâches : trois clés distinctes en tête, parente d'abord ; la sous-tâche jetée avant reste à la corbeille", async () => {
    const { a, b, c } = await orderedColumn();
    const [parent] = await seed([{ ...TRASHED, sortKey: "B" }]);
    const [sub1, sub2, started, earlier] = await seed([
      { ...TRASHED, title: "Sous 1", parentId: parent, sortKey: "V" },
      { ...TRASHED, title: "Sous 2", parentId: parent },
      {
        ...TRASHED,
        title: "Sous en cours",
        parentId: parent,
        statusCategory: "started",
        sortKey: "V",
      },
      {
        title: "Sous jetée avant",
        parentId: parent,
        deletedAt: "2026-11-17T10:00:00Z",
        sortKey: "j",
      },
    ]);
    const beforeEarlier = await one(earlier!);

    await restore(parent!);

    const column = await columnOf("unstarted");
    expect(column.slice(0, 3).sort()).toEqual([parent, sub1, sub2].sort());
    expect(column[0]).toBe(parent);
    expect(column.slice(3)).toEqual([a, b, c]);
    const keys = await keysOf(column);
    expect(keys.every((key) => key !== null)).toBe(true);
    expect(new Set(keys).size).toBe(6);
    // « En cours » n'a aucune clé : la sous-tâche restaurée y arrive sans clé.
    expect(await one(started!)).toMatchObject({
      deleted_at: null,
      sort_key: null,
    });
    expect(await one(earlier!)).toEqual(beforeEarlier);
  });
});

describe("arrivées hors dépôt : isolation et concurrence", () => {
  it("les clés d'un autre workspace ne sont ni lues ni réécrites", async () => {
    const [other, trashed] = await seed([{ title: "Sans clé" }, TRASHED]);
    const [taskB, trashedB] = await seed(
      [
        { title: "Tâche de B", side: "pro", sortKey: "V" },
        { ...TRASHED, side: "pro", sortKey: "j" },
      ],
      f.workspaceB,
      f.userB,
    );
    const before = await snapshot([taskB, trashedB] as string[]);

    const created = await create({ title: "Nouvelle", side: "private" });
    await update({ taskId: other!, statusCategory: "started" });
    await update({ taskId: other!, statusCategory: "unstarted" });
    await restore(trashed!);

    expect(await keysOf([created.id, other!, trashed!])).toEqual([
      null,
      null,
      null,
    ]);
    expect(await snapshot([taskB, trashedB] as string[])).toEqual(before);
  });

  it("tâche d'un autre workspace : changement de statut et restauration → not_found, B inchangée", async () => {
    await orderedColumn();
    const [taskB, trashedB] = await seed(
      [
        { title: "Tâche de B", side: "pro", sortKey: "V" },
        { ...TRASHED, side: "pro", sortKey: "j" },
      ],
      f.workspaceB,
      f.userB,
    );
    const before = await snapshot([taskB, trashedB] as string[]);

    for (const workspace of [f.workspaceA, f.workspaceB]) {
      await expectCode(
        asA((tx) =>
          updateTask(
            workspace,
            { taskId: taskB!, statusCategory: "started" },
            tx,
          ),
        ),
        "not_found",
      );
      await expectCode(restore(trashedB!, workspace), "not_found");
    }

    expect(await snapshot([taskB, trashedB] as string[])).toEqual(before);
  });

  it("création et déplacement en tête de la même colonne, deux connexions : le déplacement attend, clés distinctes", async () => {
    const { a, b, c, m } = await orderedColumn();
    let commitFirst = () => {};
    const gate = new Promise<void>((resolve) => (commitFirst = resolve));
    let firstCreated = () => {};
    const created = new Promise<void>((resolve) => (firstCreated = resolve));

    // Première transaction : crée, puis reste ouverte (non validée) jusqu'à l'ouverture de la porte.
    const first = asA(async (tx) => {
      const detail = await createTask(
        f.workspaceA,
        { title: "Nouvelle", side: "private" },
        "app",
        tx,
      );
      firstCreated();
      await gate;
      return detail.id;
    });
    let secondBlocked = false;
    let second: Promise<unknown> = Promise.resolve();
    try {
      await Promise.race([created, first]);
      second = move({ taskId: m!, statusCategory: "unstarted" });
      second.catch(() => undefined);
      secondBlocked = await waitForBlockedAdvisoryLock();
    } finally {
      commitFirst();
    }
    const [createdId] = await Promise.all([first, second]);

    expect(secondBlocked).toBe(true);
    expect(await columnOf("unstarted")).toEqual([m, createdId, a, b, c]);
    expect(
      new Set(await keysOf([a, b, c, m, createdId] as string[])).size,
    ).toBe(5);
  });
});
