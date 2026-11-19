// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  insertDualMember,
  newCoreFixture,
} from "../../../tests/factories/core";
import {
  insertTags,
  insertTasks,
  insertTasksFixture,
  newTasksFixture,
} from "../../../tests/factories/tasks";
import { TaskError } from "./errors";
import {
  getTask,
  listDueToday,
  listTags,
  listTasks,
  listTrashedTasks,
} from "./queries";

// Lectures du module tasks contre la branche Neon test : withUserDb réel en rôle app_backend, fixture
// préparée par le propriétaire. Chaque lecture est vérifiée avec des tâches à la corbeille dans la fixture.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/queries.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();
const t = newTasksFixture();

const TODAY = "2026-11-19";
const ALL_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;

// Ids des tâches ajoutées dans A (ordre d'insertion = ordre de création).
let ids: Record<string, string> = {};
let trashedIds: string[] = [];
let dueTodayB = "";

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertDualMember(owner, f);
  await insertTasksFixture(owner, f, t);
  await insertTags(owner, f.workspaceA, ["maison", "Client"]);
  const titles = [
    "Relancer le Devis",
    "100% payé",
    "1000 euros",
    "a_b",
    "axb",
    "c\\d",
    "cxd",
    "Devis corbeille",
    "Devis terminé",
    "Devis annulé",
    "lot-1",
    "lot-2",
    "lot-3",
    "En retard",
    "Aujourd'hui 14h",
    "Aujourd'hui",
    "Sous-tâche du jour",
    "Sous-tâche jetée",
    "Fait aujourd'hui",
    "Annulée aujourd'hui",
    "Compteur",
  ];
  const inserted = await insertTasks(owner, f.workspaceA, f.userA, [
    {
      side: "pro",
      title: "Relancer le Devis",
      priority: 2,
      dueDate: "2026-11-20",
      tags: ["client"],
    },
    { side: "private", title: "100% payé" },
    { side: "private", title: "1000 euros" },
    { side: "private", title: "a_b" },
    { side: "private", title: "axb" },
    { side: "private", title: "c\\d" },
    { side: "private", title: "cxd" },
    {
      side: "private",
      title: "Devis corbeille",
      dueDate: TODAY,
      deletedAt: "2026-11-18T10:00:00Z",
      tags: ["client"],
    },
    {
      side: "pro",
      title: "Devis terminé",
      statusCategory: "completed",
      dueDate: "2026-11-18",
    },
    { side: "pro", title: "Devis annulé", statusCategory: "canceled" },
    { side: "private", title: "lot-1" },
    { side: "private", title: "lot-2" },
    { side: "private", title: "lot-3" },
    { side: "private", title: "En retard", dueDate: "2026-11-18" },
    {
      side: "pro",
      title: "Aujourd'hui 14h",
      dueDate: TODAY,
      dueTime: "14:00",
    },
    { side: "private", title: "Aujourd'hui", dueDate: TODAY },
    {
      side: "private",
      title: "Sous-tâche du jour",
      parentId: t.taskA,
      contextId: f.contextA,
      dueDate: TODAY,
    },
    {
      side: "private",
      title: "Sous-tâche jetée",
      parentId: t.taskA,
      contextId: f.contextA,
      dueDate: TODAY,
      deletedAt: "2026-11-19T08:00:00Z",
    },
    {
      side: "private",
      title: "Fait aujourd'hui",
      statusCategory: "completed",
      dueDate: TODAY,
    },
    {
      side: "private",
      title: "Annulée aujourd'hui",
      statusCategory: "canceled",
      dueDate: TODAY,
    },
    { side: "private", title: "Compteur" },
  ]);
  ids = Object.fromEntries(titles.map((title, i) => [title, inserted[i]]));
  // Sous-tâches de « Compteur » : ouverte, terminée, annulée, à la corbeille.
  const counterSubtasks = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "Sous ouverte", parentId: ids.Compteur },
    {
      side: "private",
      title: "Sous terminée",
      parentId: ids.Compteur,
      statusCategory: "completed",
    },
    {
      side: "private",
      title: "Sous annulée",
      parentId: ids.Compteur,
      statusCategory: "canceled",
    },
    {
      side: "private",
      title: "Sous jetée",
      parentId: ids.Compteur,
      deletedAt: "2026-11-19T09:00:00Z",
    },
  ]);
  trashedIds = [
    t.trashedTaskA,
    ids["Devis corbeille"],
    ids["Sous-tâche jetée"],
    counterSubtasks[3],
  ];
  [dueTodayB] = await insertTasks(owner, f.workspaceB, f.userB, [
    { side: "pro", title: "Devis de B du jour", dueDate: TODAY },
  ]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

const titlesOf = (tasks: { title: string }[]) => tasks.map((x) => x.title);

describe("corbeille", () => {
  it("une tâche à la corbeille est absente de toute lecture sauf la corbeille", async () => {
    const result = await db.asUser(f.userA, async (tx) => ({
      all: await listTasks(
        f.workspaceA,
        { statusCategories: [...ALL_CATEGORIES], limit: 200 },
        tx,
      ),
      byTag: await listTasks(f.workspaceA, { tag: "client" }, tx),
      byQuery: await listTasks(f.workspaceA, { query: "jetée" }, tx),
      dueToday: await listDueToday(f.workspaceA, TODAY, tx),
      trashed: await Promise.all(
        trashedIds.map((id) => getTask(f.workspaceA, id, tx)),
      ),
      parent: await getTask(f.workspaceA, t.taskA, tx),
      trash: await listTrashedTasks(f.workspaceA, tx),
    }));

    const listed = [
      ...result.all.tasks,
      ...result.byTag.tasks,
      ...result.byQuery.tasks,
      ...result.dueToday,
      ...(result.parent?.subtasks ?? []),
    ].map((x) => x.id);
    for (const id of trashedIds) expect(listed).not.toContain(id);
    expect(result.trashed).toEqual(trashedIds.map(() => null));
    expect(titlesOf(result.byTag.tasks)).toEqual(["Relancer le Devis"]);

    expect(result.trash.map((x) => x.id).sort()).toEqual(
      [...trashedIds].sort(),
    );
    // Plus récente d'abord.
    expect(result.trash[0].deletedAt).toBeInstanceOf(Date);
    expect(result.trash.map((x) => x.deletedAt.getTime())).toEqual(
      [...result.trash.map((x) => x.deletedAt.getTime())].sort((a, b) => b - a),
    );
    const jetee = result.trash.find((x) => x.id === ids["Sous-tâche jetée"]);
    expect(jetee).toMatchObject({
      parentId: t.taskA,
      parentTitle: "Payer la crèche",
    });
  });
});

describe("listTasks : recherche", () => {
  it("« devis » trouve sans tenir compte de la casse, et pas « Payer la crèche »", async () => {
    const [lower, upper] = await db.asUser(f.userA, async (tx) => [
      await listTasks(f.workspaceA, { query: "devis" }, tx),
      await listTasks(f.workspaceA, { query: "  DEVIS " }, tx),
    ]);

    expect(titlesOf(lower.tasks)).toEqual(["Relancer le Devis"]);
    expect(titlesOf(upper.tasks)).toEqual(["Relancer le Devis"]);
  });

  it("« 100% », « a_b » et « c\\d » sont littéraux, pas des jokers", async () => {
    const [percent, underscore, backslash] = await db.asUser(
      f.userA,
      async (tx) => [
        await listTasks(f.workspaceA, { query: "100%" }, tx),
        await listTasks(f.workspaceA, { query: "a_b" }, tx),
        await listTasks(f.workspaceA, { query: "c\\d" }, tx),
      ],
    );

    expect(titlesOf(percent.tasks)).toEqual(["100% payé"]);
    expect(titlesOf(underscore.tasks)).toEqual(["a_b"]);
    expect(titlesOf(backslash.tasks)).toEqual(["c\\d"]);
  });
});

describe("listTasks : limite", () => {
  it("limit 2 sur 3 → 2 tâches et truncated ; limit 3 → pas tronqué", async () => {
    const [two, three] = await db.asUser(f.userA, async (tx) => [
      await listTasks(f.workspaceA, { query: "lot-", limit: 2 }, tx),
      await listTasks(f.workspaceA, { query: "lot-", limit: 3 }, tx),
    ]);

    expect(titlesOf(two.tasks)).toEqual(["lot-1", "lot-2"]);
    expect(two.truncated).toBe(true);
    expect(titlesOf(three.tasks)).toEqual(["lot-1", "lot-2", "lot-3"]);
    expect(three.truncated).toBe(false);
  });

  it("limit au-delà de 200, nulle, ou requête vide → invalid_params, sans la valeur reçue", async () => {
    for (const filter of [
      { limit: 500 },
      { limit: 0 },
      { query: "" },
      { query: "   " },
      { query: "x".repeat(101) },
      { workspaceId: f.workspaceB },
    ]) {
      const error = await db
        .asUser(f.userA, (tx) => listTasks(f.workspaceA, filter as never, tx))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TaskError);
      expect((error as TaskError).code).toBe("invalid_params");
      expect((error as TaskError).message).toBe("invalid_params");
    }
  });
});

describe("listTasks : filtres", () => {
  it("terminées et annulées exclues par défaut, incluses sur demande", async () => {
    const [byDefault, all] = await db.asUser(f.userA, async (tx) => [
      await listTasks(f.workspaceA, { query: "devis" }, tx),
      await listTasks(
        f.workspaceA,
        { query: "devis", statusCategories: [...ALL_CATEGORIES] },
        tx,
      ),
    ]);

    expect(titlesOf(byDefault.tasks)).toEqual(["Relancer le Devis"]);
    expect(titlesOf(all.tasks).sort()).toEqual(
      ["Devis annulé", "Devis terminé", "Relancer le Devis"].sort(),
    );
    const done = all.tasks.find((x) => x.title === "Devis terminé");
    expect(done?.statusCategory).toBe("completed");
  });

  it("filtre de côté : seulement les tâches de ce côté", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { side: "pro" }, tx),
    );

    expect(titlesOf(r.tasks).sort()).toEqual(
      ["Aujourd'hui 14h", "Relancer le Devis"].sort(),
    );
  });

  it("filtre d'espace : seulement les tâches de cet espace, sous-tâches comprises", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { contextId: f.contextA }, tx),
    );

    expect(titlesOf(r.tasks).sort()).toEqual(
      ["Payer la crèche", "Sous-tâche du jour", "Virement"].sort(),
    );
  });

  it("filtre de tag : nom sans tenir compte de la casse, tâche à la corbeille exclue", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { tag: "CLIENT" }, tx),
    );

    expect(r.tasks.map((x) => [x.title, x.tags])).toEqual([
      ["Relancer le Devis", ["Client"]],
    ]);
  });

  it("filtre d'échéance : au plus tard le jour donné, sans échéance exclues", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { dueOnOrBefore: "2026-11-18" }, tx),
    );

    expect(titlesOf(r.tasks)).toEqual(["En retard"]);
  });

  it("compteur n/m : sous-tâches actives, annulées exclues, faite = terminée, quel que soit le filtre", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { query: "Compteur" }, tx),
    );

    expect(r.tasks).toEqual([
      expect.objectContaining({
        title: "Compteur",
        subtaskTotal: 2,
        subtaskDone: 1,
      }),
    ]);
  });

  it("une sous-tâche porte parentId et parentTitle ; heure au format HH:MM", async () => {
    const r = await db.asUser(f.userA, async (tx) => ({
      sub: await listTasks(f.workspaceA, { query: "Sous-tâche du jour" }, tx),
      timed: await listTasks(f.workspaceA, { query: "14h" }, tx),
    }));

    expect(r.sub.tasks).toEqual([
      expect.objectContaining({
        id: ids["Sous-tâche du jour"],
        parentId: t.taskA,
        parentTitle: "Payer la crèche",
        side: "private",
        contextId: f.contextA,
        dueDate: TODAY,
        dueTime: null,
        tags: [],
      }),
    ]);
    expect(r.timed.tasks[0]).toMatchObject({
      dueDate: TODAY,
      dueTime: "14:00",
      parentId: null,
      parentTitle: null,
      priority: 0,
      completedAt: null,
    });
  });

  it("tri : échéance (sans échéance en dernier), puis priorité (aucune en dernier), puis création", async () => {
    const r = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { side: "pro" }, tx),
    );
    // Relancer le Devis (20/11, priorité 2) après Aujourd'hui 14h (19/11).
    expect(titlesOf(r.tasks)).toEqual(["Aujourd'hui 14h", "Relancer le Devis"]);

    const lots = await db.asUser(f.userA, (tx) =>
      listTasks(f.workspaceA, { query: "Aujourd'hui" }, tx),
    );
    // Même jour : heure d'abord, sans heure ensuite.
    expect(titlesOf(lots.tasks)).toEqual(["Aujourd'hui 14h", "Aujourd'hui"]);
  });
});

describe("isolation : lecture filtrée sur le workspace passé", () => {
  it("un membre de A et de B qui lit A ne voit rien de B", async () => {
    const r = await db.asUser(f.userAB, async (tx) => ({
      list: await listTasks(
        f.workspaceA,
        { statusCategories: [...ALL_CATEGORIES], limit: 200 },
        tx,
      ),
      search: await listTasks(f.workspaceA, { query: "devis" }, tx),
      due: await listDueToday(f.workspaceA, TODAY, tx),
      trash: await listTrashedTasks(f.workspaceA, tx),
      tags: await listTags(f.workspaceA, tx),
      taskB: await getTask(f.workspaceA, t.taskB, tx),
    }));

    const bIds = [t.taskB, t.subtaskB, dueTodayB];
    const seen = [...r.list.tasks, ...r.search.tasks, ...r.due, ...r.trash].map(
      (x) => x.id,
    );
    for (const id of bIds) expect(seen).not.toContain(id);
    expect(titlesOf(r.search.tasks)).toEqual(["Relancer le Devis"]);
    expect(r.tags.map((x) => x.id)).not.toContain(t.tagB);
    expect(r.taskB).toBeNull();
  });

  it("un utilisateur de A qui passe le workspace B ne lit rien (RLS)", async () => {
    const r = await db.asUser(f.userA, async (tx) => ({
      list: await listTasks(f.workspaceB, {}, tx),
      due: await listDueToday(f.workspaceB, TODAY, tx),
      trash: await listTrashedTasks(f.workspaceB, tx),
      tags: await listTags(f.workspaceB, tx),
      task: await getTask(f.workspaceB, t.taskB, tx),
    }));

    expect(r).toEqual({
      list: { tasks: [], truncated: false },
      due: [],
      trash: [],
      tags: [],
      task: null,
    });
  });
});

describe("getTask", () => {
  it("renvoie la tâche, ses notes, ses tags et ses sous-tâches actives", async () => {
    const task = await db.asUser(f.userA, (tx) =>
      getTask(f.workspaceA, t.taskA, tx),
    );

    expect(task).toMatchObject({
      id: t.taskA,
      title: "Payer la crèche",
      side: "private",
      contextId: f.contextA,
      notes: null,
      tags: [`tag-A-${f.run}`],
      parentId: null,
    });
    expect(task?.subtasks.map((x) => x.title)).toEqual([
      "Virement",
      "Sous-tâche du jour",
    ]);
    expect(task?.subtasks[1].parentTitle).toBe("Payer la crèche");
  });

  it("id invalide → invalid_params", async () => {
    const error = await db
      .asUser(f.userA, (tx) => getTask(f.workspaceA, "pas-un-uuid", tx))
      .catch((e: unknown) => e);
    expect((error as TaskError).code).toBe("invalid_params");
  });
});

describe("listDueToday", () => {
  it("en retard et dues aujourd'hui, non terminées, des deux côtés, sous-tâches comprises", async () => {
    const due = await db.asUser(f.userA, (tx) =>
      listDueToday(f.workspaceA, TODAY, tx),
    );

    expect(titlesOf(due)).toEqual([
      "En retard",
      "Aujourd'hui 14h",
      "Aujourd'hui",
      "Sous-tâche du jour",
    ]);
    expect(due[3].parentTitle).toBe("Payer la crèche");
  });

  it("une tâche annulée due aujourd'hui est exclue", async () => {
    const due = await db.asUser(f.userA, (tx) =>
      listDueToday(f.workspaceA, TODAY, tx),
    );

    expect(due.map((x) => x.id)).not.toContain(ids["Annulée aujourd'hui"]);
  });

  it("date mal formée → invalid_params", async () => {
    const error = await db
      .asUser(f.userA, (tx) => listDueToday(f.workspaceA, "19/11/2026", tx))
      .catch((e: unknown) => e);
    expect((error as TaskError).code).toBe("invalid_params");
  });
});

describe("listTags", () => {
  it("tags du workspace, triés sans tenir compte de la casse", async () => {
    const tags = await db.asUser(f.userA, (tx) => listTags(f.workspaceA, tx));

    expect(tags.map((x) => x.name)).toEqual([
      "Client",
      "maison",
      `tag-A-${f.run}`,
    ]);
    expect(tags.find((x) => x.name === "maison")?.id).toEqual(
      expect.any(String),
    );
  });
});
