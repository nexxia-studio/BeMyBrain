// @vitest-environment node
import { randomUUID } from "node:crypto";

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
  insertDualMember,
  newCoreFixture,
} from "../../../tests/factories/core";
import { insertTasks, type TaskRow } from "../../../tests/factories/tasks";
import { TaskError } from "./errors";
import {
  addTaskRelation,
  moveTask,
  moveTaskToTrash,
  restoreTask,
  updateTask,
} from "./mutations";
import {
  getTask,
  listBoard,
  listDueToday,
  listTasks,
  listUpcomingTasks,
  type Board,
} from "./queries";
import type { BoardFilter, StatusCategory } from "./schemas";

// Lectures du tableau, des relations et de « bloquée » contre la branche Neon test : withUserDb réel en rôle
// app_backend, fixture préparée par le propriétaire. Chaque test repart de workspaces sans tâche ni relation ;
// chaque jeu de données porte une tâche à la corbeille (« Jetée »), dont l'absence est vérifiée.
// Clés d'ordre et relations : posées par les mutations du module, ou par SQL propriétaire quand le test a
// besoin d'un état précis (clés choisies, masse).

// Même délai que queries.test.ts : plusieurs allers-retours Neon séquentiels par test.
vi.setConfig({ testTimeout: 30_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/queries-board.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertDualMember(owner, f);
});

beforeEach(async () => {
  const ids = [f.workspaceA, f.workspaceB];
  await owner.query("delete from task_relations where workspace_id = any($1)", [
    ids,
  ]);
  await owner.query("delete from tasks where workspace_id = any($1)", [ids]);
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

type Seed = Omit<TaskRow, "side"> & { side?: TaskRow["side"] };

const TRASHED = "Jetée";
const TRASHED_AT = "2026-11-18T10:00:00Z";

/** Tâches privées par défaut, plus une tâche ouverte à la corbeille. Renvoie les ids des tâches demandées. */
async function seed(
  rows: Seed[],
  workspace = f.workspaceA,
  user = f.userA,
): Promise<string[]> {
  const all = [...rows, { title: TRASHED, deletedAt: TRASHED_AT }];
  const ids = await insertTasks(
    owner,
    workspace,
    user,
    all.map((row) => ({ side: "private", ...row })),
  );
  return ids.slice(0, rows.length);
}

/** `count` tâches privées d'une catégorie, en une instruction ; clôture à `closedFrom` + n minutes si donné. */
async function seedMass(
  count: number,
  statusCategory: StatusCategory,
  closedFrom: string | null = null,
): Promise<void> {
  await owner.query(
    `insert into tasks (workspace_id, side, title, status_category, completed_at, origin, created_by)
     select $1, 'private', 'Masse-' || lpad(n::text, 3, '0'), $2,
       $3::timestamptz + n * interval '1 minute', 'app', $4
     from generate_series(1, $5::int) as n`,
    [f.workspaceA, statusCategory, closedFrom, f.userA, count],
  );
}

function board(filter: Partial<BoardFilter> = {}): Promise<Board> {
  return asA((tx) =>
    listBoard(f.workspaceA, { side: "private", ...filter }, tx),
  );
}

function column(b: Board, category: StatusCategory) {
  const found = b.columns.find((c) => c.category === category);
  if (!found) throw new Error("colonne absente");
  return found;
}

const titles = (b: Board, category: StatusCategory) =>
  column(b, category).tasks.map((x) => x.title);

const allTitles = (b: Board) =>
  b.columns.flatMap((c) => c.tasks.map((x) => x.title));

const detail = (id: string) => asA((tx) => getTask(f.workspaceA, id, tx));

const update = (taskId: string, change: Record<string, unknown>) =>
  asA((tx) => updateTask(f.workspaceA, { taskId, ...change }, tx));

const blocks = (taskId: string, otherTaskId: string) =>
  asA((tx) =>
    addTaskRelation(f.workspaceA, { taskId, kind: "blocks", otherTaskId }, tx),
  );

describe("listBoard : colonnes", () => {
  it("rend les cinq colonnes dans l'ordre des catégories, vides sans tâche, corbeille absente", async () => {
    await seed([]);

    const b = await board();

    expect(b).toEqual({
      columns: ["backlog", "unstarted", "started", "completed", "canceled"].map(
        (category) => ({ category, tasks: [], total: 0, truncated: false }),
      ),
    });
  });

  it("colonne ordonnée par un dépôt : la sous-tâche glissée se lit entre ses deux voisines, avec le titre de sa parente", async () => {
    const [a, b2, parent] = await seed([
      { title: "A", dueDate: "2026-12-01" },
      { title: "B", dueDate: "2026-12-02" },
      { title: "Parente" },
    ]);
    const [sub] = await seed([{ title: "Sous", parentId: parent }]);
    await asA((tx) =>
      moveTask(
        f.workspaceA,
        {
          taskId: sub,
          statusCategory: "unstarted",
          beforeId: a,
          afterId: b2,
        },
        tx,
      ),
    );

    const b = await board();

    expect(titles(b, "unstarted")).toEqual(["A", "Sous", "B", "Parente"]);
    expect(column(b, "unstarted").tasks[1]).toMatchObject({
      id: sub,
      parentId: parent,
      parentTitle: "Parente",
      tags: [],
    });
    expect(column(b, "unstarted").total).toBe(4);
    expect(allTitles(b)).not.toContain(TRASHED);
  });

  it("clés en ordre octet (« Z » avant « a »), puis les tâches sans clé dans l'ordre de la liste", async () => {
    const [z, a, b2] = await seed([
      { title: "Clé Z" },
      { title: "Clé a" },
      { title: "Clé b" },
      { title: "Sans clé, sans échéance" },
      { title: "Sans clé, basse", dueDate: "2026-12-01", priority: 4 },
      { title: "Sans clé, urgente", dueDate: "2026-12-01", priority: 1 },
    ]);
    for (const [id, key] of [
      [b2, "b"],
      [z, "Z"],
      [a, "a"],
    ]) {
      await owner.query("update tasks set sort_key = $2 where id = $1", [
        id,
        key,
      ]);
    }
    // Une clé à la corbeille reste en base, ignorée.
    await owner.query(
      "update tasks set sort_key = 'A' where workspace_id = $1 and deleted_at is not null",
      [f.workspaceA],
    );

    const b = await board();

    expect(titles(b, "unstarted")).toEqual([
      "Clé Z",
      "Clé a",
      "Clé b",
      "Sans clé, urgente",
      "Sans clé, basse",
      "Sans clé, sans échéance",
    ]);
  });

  it("plafond de 200 cartes dans une colonne ouverte : total réel et dépassement signalé", async () => {
    await seed([{ title: "En cours", statusCategory: "started" }]);
    await seedMass(205, "backlog");

    const b = await board();

    expect(column(b, "backlog").tasks).toHaveLength(200);
    expect(column(b, "backlog")).toMatchObject({ total: 205, truncated: true });
    expect(column(b, "started")).toMatchObject({ total: 1, truncated: false });
    expect(allTitles(b)).not.toContain(TRASHED);
  });

  it("Terminée et Annulée : les 20 plus récentes par clôture décroissante puis identifiant, totaux réels", async () => {
    await seedMass(25, "completed", "2026-11-20T08:00:00Z");
    await seedMass(22, "canceled", "2026-11-21T08:00:00Z");
    // Deux clôtures égales (départage par identifiant) et une terminée à la corbeille, la plus récente.
    await owner.query(
      `update tasks set completed_at = '2026-11-20T08:24:00Z'
       where workspace_id = $1 and title = 'Masse-025' and status_category = 'completed'`,
      [f.workspaceA],
    );
    const [trashed] = await seed([
      {
        title: "Terminée jetée",
        statusCategory: "completed",
        deletedAt: TRASHED_AT,
      },
    ]);
    await owner.query(
      "update tasks set completed_at = '2026-11-30T08:00:00Z' where id = $1",
      [trashed],
    );
    const { rows: expected } = await owner.query<{ id: string }>(
      `select id from tasks
       where workspace_id = $1 and status_category = 'completed' and deleted_at is null
       order by completed_at desc, id limit 20`,
      [f.workspaceA],
    );

    const byDefault = await board();
    const all = await board({ completedLimit: 200, canceledLimit: 21 });

    const done = column(byDefault, "completed");
    expect(done.tasks.map((x) => x.id)).toEqual(expected.map((x) => x.id));
    expect(done.tasks[0].completedAt).toEqual(new Date("2026-11-20T08:24:00Z"));
    expect(
      done.tasks
        .slice(0, 3)
        .map((x) => x.title)
        .sort(),
    ).toEqual(["Masse-023", "Masse-024", "Masse-025"]);
    expect(done).toMatchObject({ total: 25, truncated: true });
    const canceled = column(byDefault, "canceled");
    expect(canceled.tasks.map((x) => x.title)).toEqual(
      Array.from(
        { length: 20 },
        (_, i) => `Masse-${String(22 - i).padStart(3, "0")}`,
      ),
    );
    expect(canceled).toMatchObject({ total: 22, truncated: true });
    expect(column(all, "completed").tasks).toHaveLength(25);
    expect(column(all, "completed")).toMatchObject({
      total: 25,
      truncated: false,
    });
    expect(column(all, "canceled").tasks).toHaveLength(21);
    expect(column(all, "canceled").truncated).toBe(true);
    expect(allTitles(all)).not.toContain("Terminée jetée");
  });

  it("filtre de côté et d'espace : seulement ce côté, puis seulement cet espace", async () => {
    await seed([
      { title: "Privé dans l'espace", contextId: f.contextA },
      { title: "Privé sans espace" },
      { title: "Pro", side: "pro" },
    ]);

    const priv = await board();
    const inContext = await board({ contextId: f.contextA });
    const pro = await board({ side: "pro" });

    expect(titles(priv, "unstarted").sort()).toEqual([
      "Privé dans l'espace",
      "Privé sans espace",
    ]);
    expect(titles(inContext, "unstarted")).toEqual(["Privé dans l'espace"]);
    expect(column(inContext, "unstarted").total).toBe(1);
    expect(column(inContext, "unstarted").tasks[0]).toMatchObject({
      contextId: f.contextA,
      contextName: `ctx-A-${f.run}`,
    });
    expect(titles(pro, "unstarted")).toEqual(["Pro"]);
    expect([...allTitles(priv), ...allTitles(inContext)]).not.toContain(
      TRASHED,
    );
  });

  it("filtre invalide (côté absent, champ inconnu, limite hors bornes) → invalid_params", async () => {
    for (const filter of [
      {},
      { side: "private", workspaceId: f.workspaceB },
      { side: "private", completedLimit: 201 },
      { side: "private", canceledLimit: 0 },
    ]) {
      const error = await asA((tx) =>
        listBoard(f.workspaceA, filter as never, tx),
      ).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(TaskError);
      expect((error as TaskError).code).toBe("invalid_params");
    }
  });
});

describe("listBoard : sous-tâches", () => {
  async function family() {
    const [parent] = await seed([
      { title: "Parente" },
      { title: "Seule terminée", statusCategory: "completed" },
    ]);
    await insertTasks(owner, f.workspaceA, f.userA, [
      { side: "private", title: "Sous ouverte", parentId: parent },
      {
        side: "private",
        title: "Sous en cours",
        parentId: parent,
        statusCategory: "started",
      },
      {
        side: "private",
        title: "Sous terminée",
        parentId: parent,
        statusCategory: "completed",
      },
      {
        side: "private",
        title: "Sous annulée",
        parentId: parent,
        statusCategory: "canceled",
      },
      {
        side: "private",
        title: "Sous jetée",
        parentId: parent,
        deletedAt: TRASHED_AT,
      },
    ]);
    return parent;
  }

  it("par défaut, chaque sous-tâche active est une carte dans la colonne de son statut", async () => {
    await family();

    const b = await board();

    expect(titles(b, "unstarted").sort()).toEqual(["Parente", "Sous ouverte"]);
    expect(titles(b, "started")).toEqual(["Sous en cours"]);
    expect(titles(b, "completed").sort()).toEqual([
      "Seule terminée",
      "Sous terminée",
    ]);
    expect(column(b, "completed").total).toBe(2);
    expect(titles(b, "canceled")).toEqual(["Sous annulée"]);
    expect(allTitles(b)).not.toContain("Sous jetée");
    expect(allTitles(b)).not.toContain(TRASHED);
  });

  it("subtaskOpen compte les sous-tâches actives ouvertes, sans changer le compteur n/m", async () => {
    const parent = await family();

    const b = await board();
    const read = await detail(parent);

    const card = column(b, "unstarted").tasks.find((x) => x.id === parent);
    expect(card).toMatchObject({
      subtaskOpen: 2,
      subtaskTotal: 3,
      subtaskDone: 1,
    });
    expect(read).toMatchObject({
      subtaskOpen: 2,
      subtaskTotal: 3,
      subtaskDone: 1,
    });
    expect(read?.subtasks.map((x) => x.subtaskOpen)).toEqual([0, 0, 0, 0]);
  });

  it("includeSubtasks: false → premier niveau seulement, totaux compris, compteurs des parentes inchangés", async () => {
    const parent = await family();

    const b = await board({ includeSubtasks: false });

    expect(titles(b, "unstarted")).toEqual(["Parente"]);
    expect(titles(b, "started")).toEqual([]);
    expect(titles(b, "completed")).toEqual(["Seule terminée"]);
    expect(titles(b, "canceled")).toEqual([]);
    expect(b.columns.map((c) => c.total)).toEqual([0, 1, 0, 1, 0]);
    expect(column(b, "unstarted").tasks[0]).toMatchObject({
      id: parent,
      subtaskOpen: 2,
      subtaskTotal: 3,
      subtaskDone: 1,
    });
  });

  it("hideCompletedSubtasks retire les sous-tâches terminées et corrige le total, pas les annulées ni les ouvertes", async () => {
    await family();

    const b = await board({ hideCompletedSubtasks: true });

    expect(titles(b, "completed")).toEqual(["Seule terminée"]);
    expect(column(b, "completed")).toMatchObject({
      total: 1,
      truncated: false,
    });
    expect(titles(b, "canceled")).toEqual(["Sous annulée"]);
    expect(column(b, "canceled").total).toBe(1);
    expect(titles(b, "unstarted").sort()).toEqual(["Parente", "Sous ouverte"]);
    expect(titles(b, "started")).toEqual(["Sous en cours"]);
    expect(allTitles(b)).not.toContain(TRASHED);
  });
});

describe("blocked : dérivé à la lecture", () => {
  async function blockedPair() {
    const [blocked, blocker, linked] = await seed([
      { title: "Bloquée", dueDate: "2026-11-19" },
      { title: "Bloquante" },
      { title: "Liée" },
    ]);
    await blocks(blocker, blocked);
    await asA((tx) =>
      addTaskRelation(
        f.workspaceA,
        { taskId: linked, kind: "related", otherTaskId: blocker },
        tx,
      ),
    );
    return { blocked, blocker, linked };
  }

  const isBlocked = async (id: string) => (await detail(id))?.blocked;

  it("vrai avec une bloquante ouverte, dans le tableau, la liste, les tuiles et le détail ; faux pour la bloquante et pour une tâche liée", async () => {
    const { blocked, blocker, linked } = await blockedPair();

    const r = await asA(async (tx) => ({
      board: await listBoard(f.workspaceA, { side: "private" }, tx),
      list: await listTasks(f.workspaceA, {}, tx),
      due: await listDueToday(f.workspaceA, "2026-11-19", tx),
      upcoming: await listUpcomingTasks(f.workspaceA, { side: "private" }, tx),
      detail: await getTask(f.workspaceA, blocked, tx),
    }));

    const flags = (tasks: { id: string; blocked: boolean }[]) =>
      Object.fromEntries(tasks.map((x) => [x.id, x.blocked]));
    const expected = { [blocked]: true, [blocker]: false, [linked]: false };
    expect(flags(column(r.board, "unstarted").tasks)).toEqual(expected);
    expect(flags(r.list.tasks)).toEqual(expected);
    expect(flags(r.upcoming)).toEqual(expected);
    expect(flags(r.due)).toEqual({ [blocked]: true });
    expect(r.detail?.blocked).toBe(true);
  });

  it.each(["completed", "canceled"] as const)(
    "faux quand la bloquante est %s, vrai de nouveau quand elle est rouverte",
    async (statusCategory) => {
      const { blocked, blocker } = await blockedPair();

      await update(blocker, { statusCategory });
      const closed = await isBlocked(blocked);
      await update(blocker, { statusCategory: "started" });
      const reopened = await isBlocked(blocked);

      expect(closed).toBe(false);
      expect(reopened).toBe(true);
    },
  );

  it("faux quand la bloquante est à la corbeille, vrai de nouveau à sa restauration", async () => {
    const { blocked, blocker } = await blockedPair();

    await asA((tx) => moveTaskToTrash(f.workspaceA, blocker, tx));
    const trashed = await isBlocked(blocked);
    await asA((tx) => restoreTask(f.workspaceA, blocker, tx));
    const restored = await isBlocked(blocked);

    expect(trashed).toBe(false);
    expect(restored).toBe(true);
  });

  it("faux quand la bloquante est passée de l'autre côté, vrai de nouveau à son retour", async () => {
    const { blocked, blocker } = await blockedPair();

    await update(blocker, { side: "pro" });
    const across = await isBlocked(blocked);
    await update(blocker, { side: "private" });
    const back = await isBlocked(blocked);

    expect(across).toBe(false);
    expect(back).toBe(true);
  });

  it("faux pour une tâche elle-même terminée, même avec une bloquante ouverte", async () => {
    const { blocked } = await blockedPair();

    await update(blocked, { statusCategory: "completed" });
    const b = await board();

    expect(column(b, "completed").tasks).toEqual([
      expect.objectContaining({ id: blocked, blocked: false }),
    ]);
  });
});

describe("getTask : relations", () => {
  // Identifiants choisis : « Liée à » est rangée plus petit identifiant en premier, donc dans un sens pour
  // `low` et dans l'autre pour `high`.
  const withFirst = (digit: string) => digit + randomUUID().slice(1);

  async function related() {
    const [task, blocked, blocker, low, high] = await seed([
      { title: "Tâche", id: withFirst("5") },
      { title: "Que je bloque", contextId: f.contextA },
      { title: "Qui me bloque", statusCategory: "started" },
      { title: "Liée", id: withFirst("1") },
      { title: "Liée", id: withFirst("9") },
    ]);
    const add = (kind: "blocks" | "blocked_by" | "related", other: string) =>
      asA((tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: task, kind, otherTaskId: other },
          tx,
        ),
      );
    await add("blocks", blocked);
    await add("blocked_by", blocker);
    await add("related", high);
    await add("related", low);
    return { task, blocked, blocker, low, high };
  }

  const item = (id: string, title: string, statusCategory = "unstarted") => ({
    id,
    title,
    statusCategory,
    contextName: null,
    contextColor: null,
  });

  it("groupe les relations dans les trois sens, « Liée à » rangée dans un sens ou l'autre, par titre puis identifiant", async () => {
    const { task, blocked, blocker, low, high } = await related();

    const read = await detail(task);
    const other = await detail(blocked);

    expect(read?.relations).toEqual({
      blocks: [
        {
          ...item(blocked, "Que je bloque"),
          contextName: `ctx-A-${f.run}`,
          contextColor: "neutral",
        },
      ],
      blockedBy: [item(blocker, "Qui me bloque", "started")],
      related: [item(low, "Liée"), item(high, "Liée")],
    });
    expect(other?.relations).toEqual({
      blocks: [],
      blockedBy: [item(task, "Tâche")],
      related: [],
    });
  });

  it("une relation vers la corbeille est masquée, puis revient à la restauration", async () => {
    const { task, blocked, low } = await related();

    await asA((tx) => moveTaskToTrash(f.workspaceA, blocked, tx));
    await asA((tx) => moveTaskToTrash(f.workspaceA, low, tx));
    const hidden = await detail(task);
    await asA((tx) => restoreTask(f.workspaceA, blocked, tx));
    await asA((tx) => restoreTask(f.workspaceA, low, tx));
    const back = await detail(task);

    expect(hidden?.relations.blocks).toEqual([]);
    expect(hidden?.relations.related.map((x) => x.id)).not.toContain(low);
    expect(back?.relations.blocks.map((x) => x.id)).toEqual([blocked]);
    expect(back?.relations.related.map((x) => x.id)).toContain(low);
  });

  it("une relation devenue transversale est masquée des deux côtés, puis revient quand les côtés coïncident", async () => {
    const { task, blocker, high } = await related();

    await update(blocker, { side: "pro" });
    await update(high, { side: "pro" });
    const hidden = await detail(task);
    const fromOther = await detail(blocker);
    await update(blocker, { side: "private" });
    await update(high, { side: "private" });
    const back = await detail(task);

    expect(hidden?.relations.blockedBy).toEqual([]);
    expect(hidden?.relations.related.map((x) => x.id)).not.toContain(high);
    expect(fromOther?.relations).toEqual({
      blocks: [],
      blockedBy: [],
      related: [],
    });
    expect(back?.relations.blockedBy.map((x) => x.id)).toEqual([blocker]);
    expect(back?.relations.related.map((x) => x.id)).toContain(high);
  });

  it("une tâche sans relation porte trois groupes vides", async () => {
    const [task] = await seed([{ title: "Seule" }]);

    const read = await detail(task);

    expect(read?.relations).toEqual({ blocks: [], blockedBy: [], related: [] });
  });
});

describe("listTasks : topLevelOnly", () => {
  it("ne rend que les tâches sans parente ; sans l'option, les sous-tâches sont comprises", async () => {
    const [parent] = await seed([{ title: "Parente" }, { title: "Seule" }]);
    await seed([{ title: "Sous", parentId: parent }]);

    const [top, all] = await asA(async (tx) => [
      await listTasks(f.workspaceA, { topLevelOnly: true }, tx),
      await listTasks(f.workspaceA, { topLevelOnly: false }, tx),
    ]);

    const names = (list: { tasks: { title: string }[] }) =>
      list.tasks.map((x) => x.title).sort();
    expect(names(top)).toEqual(["Parente", "Seule"]);
    expect(names(all)).toEqual(["Parente", "Seule", "Sous"]);
  });
});

describe("isolation et clé d'ordre", () => {
  it("un membre de A et de B qui lit A ne voit ni tâche ni relation de B ; A qui passe B ne lit rien", async () => {
    const [mine] = await seed([{ title: "Pro de A", side: "pro" }]);
    const [b1, b2] = await seed(
      [
        { title: "Pro de B", side: "pro" },
        { title: "Bloquante de B", side: "pro" },
      ],
      f.workspaceB,
      f.userB,
    );
    await owner.query(
      "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, 'blocks')",
      [f.workspaceB, b2, b1],
    );

    const dual = await db.asUser(f.userAB, async (tx) => ({
      board: await listBoard(f.workspaceA, { side: "pro" }, tx),
      taskOfB: await getTask(f.workspaceA, b1, tx),
      mine: await getTask(f.workspaceA, mine, tx),
      // Témoin : la relation de B existe et se lit dans B.
      inB: await getTask(f.workspaceB, b1, tx),
    }));
    const foreign = await asA(async (tx) => ({
      board: await listBoard(f.workspaceB, { side: "pro" }, tx),
      task: await getTask(f.workspaceB, b1, tx),
    }));

    expect(allTitles(dual.board)).toEqual(["Pro de A"]);
    expect(dual.taskOfB).toBeNull();
    expect(dual.mine?.relations).toEqual({
      blocks: [],
      blockedBy: [],
      related: [],
    });
    expect(dual.inB).toMatchObject({ blocked: true });
    expect(dual.inB?.relations.blockedBy.map((x) => x.id)).toEqual([b2]);
    expect(foreign.board.columns.map((c) => [c.tasks.length, c.total])).toEqual(
      [0, 0, 0, 0, 0].map(() => [0, 0]),
    );
    expect(foreign.task).toBeNull();
  });

  it("aucune clé d'ordre dans les objets rendus", async () => {
    const [a, b2] = await seed([{ title: "A" }, { title: "B" }]);
    await asA((tx) =>
      moveTask(
        f.workspaceA,
        { taskId: b2, statusCategory: "unstarted", afterId: a },
        tx,
      ),
    );

    const r = await asA(async (tx) => ({
      board: await listBoard(f.workspaceA, { side: "private" }, tx),
      list: await listTasks(f.workspaceA, {}, tx),
      detail: await getTask(f.workspaceA, a, tx),
    }));

    expect(titles(r.board, "unstarted")).toEqual(["B", "A"]);
    expect(JSON.stringify(r)).not.toMatch(/sort_?key/i);
    expect(allTitles(r.board)).not.toContain(TRASHED);
  });
});
