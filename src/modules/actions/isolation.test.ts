// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import {
  insertTasks,
  insertTasksFixture,
  newTasksFixture,
} from "../../../tests/factories/tasks";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { keyBetween } from "@/modules/tasks/sort-key";

import { invokeAction, prepareAction, registry } from "./registry";

// Isolation du registre (constitution 5) contre la branche Neon test : withUserDb réel en rôle app_backend,
// actions du registre lancées pour un utilisateur avec le workspace d'un autre. Rien n'est lu ni écrit.

// Délai propre aux tests base de ce fichier : un `it` enchaîne jusqu'à une vingtaine d'allers-retours Neon
// séquentiels (8 actions + deux relectures d'état). Mesuré le 2026-11-19 : 1,7 s en local, ~4x en CI
// (branche éphémère), soit plus que les 5 s par défaut. 20 s laisse ~3x de marge sur le pire mesuré.
vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/actions/isolation.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();
const t = newTasksFixture();
// En plus de la fixture partagée (laissée telle quelle pour les autres tests) : de quoi rendre non vides
// les lectures du jour et de la corbeille, des deux côtés.
const today = todayIn(getUserTimeZone(), new Date());
const extra = { dueTodayA: "", dueTodayB: "", trashedB: "" };
// Tableau, parente et relations (todo-kanban) : tâches à part, pour ne pas déranger les témoins ci-dessus.
// A est en privé, B en pro. `startedA1` et `startedA2` sont En cours avec deux clés d'ordre placées au-dessus
// de la clé de tête d'une colonne vide ; `blockerA` bloque `blockedA` (relation existante de A).
const board = {
  moveA: "",
  childA: "",
  parentA: "",
  blockerA: "",
  blockedA: "",
  startedA1: "",
  startedA2: "",
  moveB: "",
  childB: "",
  loneB: "",
};
const emptyColumnKey = keyBetween(null, null);
const keyA1 = keyBetween(emptyColumnKey, null);
const keyA2 = keyBetween(keyA1, null);

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertTasksFixture(owner, f, t);
  [extra.dueTodayA] = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "Due aujourd'hui A", dueDate: today },
  ]);
  [extra.dueTodayB, extra.trashedB] = await insertTasks(
    owner,
    f.workspaceB,
    f.userB,
    [
      { side: "pro", title: "Due aujourd'hui B", dueDate: today },
      {
        side: "pro",
        title: "Jetée B",
        deletedAt: new Date().toISOString(),
      },
    ],
  );
  [
    board.moveA,
    board.childA,
    board.parentA,
    board.blockerA,
    board.blockedA,
    board.startedA1,
    board.startedA2,
  ] = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "À déplacer A" },
    { side: "private", title: "À rattacher A" },
    { side: "private", title: "Parente A", contextId: f.contextA },
    { side: "private", title: "Bloquante A" },
    { side: "private", title: "Bloquée A" },
    { side: "private", title: "En cours A 1", statusCategory: "started" },
    { side: "private", title: "En cours A 2", statusCategory: "started" },
  ]);
  await owner.query(
    "update tasks set sort_key = case id when $1 then $3 else $4 end where id in ($1, $2)",
    [board.startedA1, board.startedA2, keyA1, keyA2],
  );
  await owner.query(
    "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, 'blocks')",
    [f.workspaceA, board.blockerA, board.blockedA],
  );
  [board.moveB, board.childB, board.loneB] = await insertTasks(
    owner,
    f.workspaceB,
    f.userB,
    [
      { side: "pro", title: "À déplacer B" },
      { side: "pro", title: "À rattacher B" },
      { side: "pro", title: "Seule B" },
    ],
  );
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

function run(
  userId: string,
  workspaceId: string,
  name: string,
  params: unknown,
) {
  const prepared = prepareAction(registry, name, params, "web");
  return db.asUser(userId, (tx, identity) =>
    invokeAction(prepared, {
      workspaceId,
      userId: identity.userId,
      origin: "palette",
      tx,
    }),
  );
}

async function localeOf(workspaceId: string, userId: string) {
  const { rows } = await owner.query<{ locale: string }>(
    "select locale from workspace_members where workspace_id = $1 and user_id = $2",
    [workspaceId, userId],
  );
  return rows[0]?.locale;
}

describe("registre d'actions : isolation entre deux workspaces", () => {
  it("core.listContexts lancé par B sur le workspace de A ne renvoie rien", async () => {
    const result = await run(f.userB, f.workspaceA, "core.listContexts", {
      side: "private",
    });

    expect(result).toEqual([]);
  });

  it("core.listContexts lancé par A sur son workspace renvoie ses contextes", async () => {
    const result = await run(f.userA, f.workspaceA, "core.listContexts", {
      side: "private",
    });

    expect(result).toEqual([
      expect.objectContaining({ id: f.contextA, side: "private" }),
    ]);
  });

  it("core.setLocale lancé par B sur le workspace de A n'écrit rien", async () => {
    const attempt = run(f.userB, f.workspaceA, "core.setLocale", {
      locale: "en",
    });

    await expect(attempt).rejects.toMatchObject({ code: "member_not_found" });
    expect(await localeOf(f.workspaceA, f.userA)).toBe("fr");
    expect(await localeOf(f.workspaceA, f.userA2)).toBe("en");
  });
});

/** Tâches, tags, liens et relations d'un workspace, lus en propriétaire (hors RLS), triés : témoin « rien de changé ». */
async function stateOf(workspaceId: string) {
  const tasks = await owner.query(
    `select id, title, status_category, priority, notes, due_date, deleted_at, side, context_id, completed_at,
       parent_id, sort_key, updated_at
     from tasks where workspace_id = $1 order by id`,
    [workspaceId],
  );
  const tags = await owner.query(
    "select id, name from tags where workspace_id = $1 order by id",
    [workspaceId],
  );
  const links = await owner.query(
    "select task_id, tag_id from task_tags where workspace_id = $1 order by task_id, tag_id",
    [workspaceId],
  );
  const relations = await owner.query(
    `select id, from_task_id, to_task_id, kind from task_relations where workspace_id = $1
     order by from_task_id, to_task_id, kind`,
    [workspaceId],
  );
  return {
    tasks: tasks.rows,
    tags: tags.rows,
    links: links.rows,
    relations: relations.rows,
  };
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);

async function readAll(userId: string, workspaceId: string) {
  const list = (await run(userId, workspaceId, "tasks.list", {})) as {
    tasks: { id: string }[];
  };
  const due = (await run(userId, workspaceId, "tasks.listDueToday", {})) as {
    id: string;
  }[];
  const trash = (await run(userId, workspaceId, "tasks.listTrash", {})) as {
    id: string;
  }[];
  const tags = (await run(userId, workspaceId, "tasks.listTags", {})) as {
    id: string;
  }[];
  return {
    list: ids(list.tasks),
    due: ids(due),
    trash: ids(trash),
    tags: ids(tags),
  };
}

const RLS_REFUSAL = { name: "DatabaseError", code: "42501" };

describe("registre d'actions : isolation des actions tasks.*, session de A sur son workspace", () => {
  it("les lectures de A voient ses tâches (témoin) et rien de B", async () => {
    const seen = await readAll(f.userA, f.workspaceA);

    expect(seen.list).toEqual(
      expect.arrayContaining([t.taskA, t.subtaskA, extra.dueTodayA]),
    );
    expect(seen.due).toContain(extra.dueTodayA);
    expect(seen.trash).toContain(t.trashedTaskA);
    expect(seen.tags).toContain(t.tagA);
    const ofB = [t.taskB, t.subtaskB, extra.dueTodayB, extra.trashedB, t.tagB];
    for (const found of Object.values(seen)) {
      for (const id of ofB) expect(found).not.toContain(id);
    }
  });

  it("tasks.list de A avec le nom de l'espace de B → context_not_found", async () => {
    const attempt = run(f.userA, f.workspaceA, "tasks.list", {
      context: `ctx-B-${f.run}`,
    });

    await expect(attempt).rejects.toMatchObject({ code: "context_not_found" });
  });

  it("get, update, complete, moveToTrash et restore de A sur les tâches de B (active ou à la corbeille) → not_found, B inchangé", async () => {
    const before = await stateOf(f.workspaceB);
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.get", { taskId: t.taskB }],
      ["tasks.get", { taskId: extra.trashedB }],
      ["tasks.update", { taskId: t.taskB, title: "intrus" }],
      ["tasks.update", { taskId: t.taskB, addTags: ["intrus"] }],
      ["tasks.complete", { taskId: t.taskB }],
      ["tasks.moveToTrash", { taskId: t.taskB }],
      ["tasks.restore", { taskId: t.taskB }],
      ["tasks.restore", { taskId: extra.trashedB }],
    ];

    for (const [name, params] of attempts) {
      await expect(
        run(f.userA, f.workspaceA, name, params),
        `${name} ${JSON.stringify(params)}`,
      ).rejects.toMatchObject({ code: "not_found" });
    }
    expect(await stateOf(f.workspaceB)).toEqual(before);
  });

  it("tasks.create de A sous une parente de B → not_found, rien d'écrit", async () => {
    const before = [await stateOf(f.workspaceA), await stateOf(f.workspaceB)];

    const attempt = run(f.userA, f.workspaceA, "tasks.create", {
      title: "intrus",
      parentId: t.taskB,
    });

    await expect(attempt).rejects.toMatchObject({ code: "not_found" });
    expect([await stateOf(f.workspaceA), await stateOf(f.workspaceB)]).toEqual(
      before,
    );
  });

  it("tasks.create et tasks.update de A avec le nom de l'espace de B → context_not_found, rien d'écrit", async () => {
    const before = [await stateOf(f.workspaceA), await stateOf(f.workspaceB)];
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.create", { title: "intrus", context: `ctx-B-${f.run}` }],
      ["tasks.update", { taskId: t.taskA, context: `ctx-B-${f.run}` }],
    ];

    for (const [name, params] of attempts) {
      await expect(
        run(f.userA, f.workspaceA, name, params),
        name,
      ).rejects.toMatchObject({ code: "context_not_found" });
    }
    expect([await stateOf(f.workspaceA), await stateOf(f.workspaceB)]).toEqual(
      before,
    );
  });

  it("tasks.update de A avec le nom d'un tag de B : addTags crée un tag dans A, removeTags ne touche pas le lien de B", async () => {
    const tagNameB = `tag-B-${f.run}`;
    const before = await stateOf(f.workspaceB);

    await run(f.userA, f.workspaceA, "tasks.update", {
      taskId: t.taskA,
      addTags: [tagNameB],
    });
    const { rows: linked } = await owner.query<{ workspace_id: string }>(
      `select tg.workspace_id from task_tags tt join tags tg on tg.id = tt.tag_id
       where tt.task_id = $1 and lower(tg.name) = lower($2)`,
      [t.taskA, tagNameB],
    );
    await run(f.userA, f.workspaceA, "tasks.update", {
      taskId: t.taskA,
      removeTags: [tagNameB],
    });

    expect(linked).toEqual([{ workspace_id: f.workspaceA }]);
    expect(await stateOf(f.workspaceB)).toEqual(before);
    const { rows: linksOfTagB } = await owner.query(
      "select task_id from task_tags where tag_id = $1",
      [t.tagB],
    );
    expect(linksOfTagB).toEqual([{ task_id: t.taskB }]);
  });
});

describe("registre d'actions : isolation des actions tasks.*, session de B sur le workspace de A", () => {
  it("les quatre lectures ne renvoient rien", async () => {
    const list = await run(f.userB, f.workspaceA, "tasks.list", {});
    const seen = await readAll(f.userB, f.workspaceA);

    expect(list).toEqual({ tasks: [], truncated: false });
    expect(seen).toEqual({ list: [], due: [], trash: [], tags: [] });
  });

  it("tasks.get d'une tâche de A → not_found", async () => {
    const attempt = run(f.userB, f.workspaceA, "tasks.get", {
      taskId: t.taskA,
    });

    await expect(attempt).rejects.toMatchObject({ code: "not_found" });
  });

  it("les cinq écritures sont refusées (not_found ou 42501), A relu en propriétaire inchangé", async () => {
    const before = await stateOf(f.workspaceA);
    const attempts: [string, Record<string, unknown>, object][] = [
      ["tasks.create", { title: "intrus", side: "private" }, RLS_REFUSAL],
      [
        "tasks.create",
        { title: "intrus", parentId: t.taskA },
        { code: "not_found" },
      ],
      [
        "tasks.create",
        { title: "intrus", context: `ctx-A-${f.run}` },
        { code: "context_not_found" },
      ],
      [
        "tasks.update",
        { taskId: t.taskA, title: "intrus" },
        { code: "not_found" },
      ],
      ["tasks.complete", { taskId: t.taskA }, { code: "not_found" }],
      ["tasks.moveToTrash", { taskId: t.taskA }, { code: "not_found" }],
      ["tasks.restore", { taskId: t.trashedTaskA }, { code: "not_found" }],
    ];

    for (const [name, params, refusal] of attempts) {
      await expect(
        run(f.userB, f.workspaceA, name, params),
        `${name} ${JSON.stringify(params)}`,
      ).rejects.toMatchObject(refusal);
    }
    expect(await stateOf(f.workspaceA)).toEqual(before);
  });

  it("tasks.move, tasks.setParent, tasks.addRelation et tasks.removeRelation sur les tâches de A → not_found, A relu en propriétaire inchangé", async () => {
    const before = await stateOf(f.workspaceA);
    const relation = { kind: "blocks", otherTaskId: board.blockedA };
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.move", { taskId: board.moveA, statusCategory: "completed" }],
      ["tasks.setParent", { taskId: board.childA, parentId: board.parentA }],
      ["tasks.setParent", { taskId: t.subtaskA, parentId: null }],
      ["tasks.addRelation", { taskId: board.moveA, ...relation }],
      ["tasks.removeRelation", { taskId: board.blockerA, ...relation }],
    ];

    for (const [name, params] of attempts) {
      await expect(
        run(f.userB, f.workspaceA, name, params),
        `${name} ${JSON.stringify(params)}`,
      ).rejects.toMatchObject(NOT_FOUND);
    }
    expect(await stateOf(f.workspaceA)).toEqual(before);
  });

  it("tasks.listBoard ne rend aucune carte de A : cinq colonnes vides, totaux à zéro", async () => {
    const result = await run(f.userB, f.workspaceA, "tasks.listBoard", {
      side: "private",
    });

    expect(result).toEqual(EMPTY_BOARD);
  });
});

const NOT_FOUND = {
  name: "TaskError",
  code: "not_found",
  message: "not_found",
};

const BOARD_ORDER = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
];
const EMPTY_BOARD = {
  columns: BOARD_ORDER.map((category) => ({
    category,
    tasks: [],
    total: 0,
    truncated: false,
  })),
};

type BoardResult = {
  columns: { category: string; tasks: { id: string }[]; total: number }[];
};
const cardsOf = (result: unknown) =>
  (result as BoardResult).columns.flatMap((column) => ids(column.tasks));

/** Ligne d'une tâche lue en propriétaire (hors RLS) : ce que les écritures du tableau et de la parente posent. */
async function rowOf(taskId: string) {
  const { rows } = await owner.query<{
    status_category: string;
    sort_key: string | null;
    parent_id: string | null;
    context_id: string | null;
  }>(
    "select status_category, sort_key, parent_id, context_id from tasks where id = $1",
    [taskId],
  );
  return rows[0];
}

async function relationsBetween(a: string, b: string) {
  const { rows } = await owner.query(
    `select workspace_id, from_task_id, to_task_id, kind from task_relations
     where (from_task_id = $1 and to_task_id = $2) or (from_task_id = $2 and to_task_id = $1)`,
    [a, b],
  );
  return rows;
}

describe("registre d'actions : tableau, parente et relations, session de A sur son workspace (bout en bout)", () => {
  it("tasks.move range la tâche de A dans la colonne visée, entre ses deux voisines", async () => {
    const result = await run(f.userA, f.workspaceA, "tasks.move", {
      taskId: board.moveA,
      statusCategory: "started",
      beforeId: board.startedA1,
      afterId: board.startedA2,
    });

    const row = await rowOf(board.moveA);
    expect(result).toMatchObject({
      id: board.moveA,
      statusCategory: "started",
    });
    expect(result).not.toHaveProperty("sortKey");
    expect(row.status_category).toBe("started");
    expect(row.sort_key! > keyA1 && row.sort_key! < keyA2).toBe(true);
  });

  it("tasks.setParent rattache la tâche de A (elle prend l'espace de la parente), puis la détache avec null", async () => {
    const attached = await run(f.userA, f.workspaceA, "tasks.setParent", {
      taskId: board.childA,
      parentId: board.parentA,
    });
    const rowAttached = await rowOf(board.childA);
    const detached = await run(f.userA, f.workspaceA, "tasks.setParent", {
      taskId: board.childA,
      parentId: null,
    });
    const rowDetached = await rowOf(board.childA);

    expect(attached).toMatchObject({ parentId: board.parentA });
    expect(rowAttached).toMatchObject({
      parent_id: board.parentA,
      context_id: f.contextA,
    });
    expect(detached).toMatchObject({ parentId: null });
    expect(rowDetached).toMatchObject({
      parent_id: null,
      context_id: f.contextA,
    });
  });

  it("tasks.addRelation range le blocage dans le workspace de A, lu depuis la tâche", async () => {
    const result = await run(f.userA, f.workspaceA, "tasks.addRelation", {
      taskId: board.childA,
      kind: "blocked_by",
      otherTaskId: board.blockerA,
    });

    expect(await relationsBetween(board.childA, board.blockerA)).toEqual([
      {
        workspace_id: f.workspaceA,
        from_task_id: board.blockerA,
        to_task_id: board.childA,
        kind: "blocks",
      },
    ]);
    expect(
      ids(
        (result as { relations: { blockedBy: { id: string }[] } }).relations
          .blockedBy,
      ),
    ).toEqual([board.blockerA]);
  });

  it("tasks.removeRelation retire la relation de A", async () => {
    await owner.query(
      "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, 'blocks')",
      [f.workspaceA, board.parentA, board.moveA],
    );

    const result = await run(f.userA, f.workspaceA, "tasks.removeRelation", {
      taskId: board.moveA,
      kind: "blocked_by",
      otherTaskId: board.parentA,
    });

    expect(await relationsBetween(board.moveA, board.parentA)).toEqual([]);
    expect(
      (result as { relations: { blockedBy: unknown[] } }).relations.blockedBy,
    ).toEqual([]);
  });

  it("tasks.listBoard de A rend ses colonnes dans l'ordre du tableau et aucune carte de B, même du côté où B a ses tâches", async () => {
    const privateSide = await run(f.userA, f.workspaceA, "tasks.listBoard", {
      side: "private",
    });
    const proSide = await run(f.userA, f.workspaceA, "tasks.listBoard", {
      side: "pro",
    });

    expect(
      (privateSide as BoardResult).columns.map((column) => column.category),
    ).toEqual(BOARD_ORDER);
    expect(cardsOf(privateSide)).toEqual(
      expect.arrayContaining([t.taskA, t.subtaskA, board.startedA1]),
    );
    expect(proSide).toEqual(EMPTY_BOARD);
  });

  it("aucun paramètre ne vise un autre workspace : workspaceId de B en paramètre → invalid_params avant toute transaction, B inchangé", async () => {
    const before = await stateOf(f.workspaceB);
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.move", { taskId: board.moveB, statusCategory: "started" }],
      ["tasks.setParent", { taskId: board.childB, parentId: board.loneB }],
      [
        "tasks.addRelation",
        { taskId: board.childB, kind: "blocks", otherTaskId: board.loneB },
      ],
      [
        "tasks.removeRelation",
        { taskId: board.childB, kind: "blocks", otherTaskId: board.loneB },
      ],
      ["tasks.listBoard", { side: "pro" }],
    ];

    for (const [name, params] of attempts) {
      expect(
        () =>
          run(f.userA, f.workspaceA, name, {
            ...params,
            workspaceId: f.workspaceB,
          }),
        name,
      ).toThrow(expect.objectContaining({ code: "invalid_params" }));
    }
    expect(await stateOf(f.workspaceB)).toEqual(before);
  });
});

describe("registre d'actions : tableau, parente et relations, session de B sur son workspace avec des identifiants de A", () => {
  /** Chaque tentative est rejouée avec un identifiant inexistant à la place de celui de A : même réponse. */
  async function expectNotFoundLikeUnknown(
    attempts: [string, Record<string, unknown>, string][],
  ) {
    for (const [name, params, key] of attempts) {
      for (const variant of [params, { ...params, [key]: randomUUID() }]) {
        await expect(
          run(f.userB, f.workspaceB, name, variant),
          `${name} ${key}`,
        ).rejects.toMatchObject(NOT_FOUND);
      }
    }
  }

  it("tasks.move d'une tâche de A → not_found, comme un identifiant inexistant ; A et B inchangés", async () => {
    const before = [await stateOf(f.workspaceA), await stateOf(f.workspaceB)];

    await expectNotFoundLikeUnknown([
      [
        "tasks.move",
        { taskId: board.startedA1, statusCategory: "completed" },
        "taskId",
      ],
      [
        "tasks.move",
        { taskId: t.taskA, statusCategory: "started", afterId: board.moveB },
        "taskId",
      ],
    ]);

    expect([await stateOf(f.workspaceA), await stateOf(f.workspaceB)]).toEqual(
      before,
    );
  });

  it("tasks.move d'une tâche de B avec des voisines de A : la place obtenue est celle de voisines inexistantes, la clé ne dépend pas de A", async () => {
    const before = await stateOf(f.workspaceA);
    const move = (params: Record<string, unknown>) =>
      run(f.userB, f.workspaceB, "tasks.move", {
        taskId: board.moveB,
        ...params,
      });

    await move({
      statusCategory: "started",
      beforeId: randomUUID(),
      afterId: randomUUID(),
    });
    const withUnknown = await rowOf(board.moveB);
    await move({ statusCategory: "unstarted" });
    await move({
      statusCategory: "started",
      beforeId: board.startedA1,
      afterId: board.startedA2,
    });
    const withNeighboursOfA = await rowOf(board.moveB);

    expect(withNeighboursOfA).toEqual(withUnknown);
    expect(withNeighboursOfA.sort_key).toBe(emptyColumnKey);
    expect(withNeighboursOfA.sort_key! < keyA1).toBe(true);
    expect(await stateOf(f.workspaceA)).toEqual(before);
  });

  it("tasks.setParent d'une tâche de A, ou d'une tâche de B sous une parente de A → not_found, comme un identifiant inexistant ; A et B inchangés", async () => {
    const before = [await stateOf(f.workspaceA), await stateOf(f.workspaceB)];

    await expectNotFoundLikeUnknown([
      [
        "tasks.setParent",
        { taskId: board.childA, parentId: board.loneB },
        "taskId",
      ],
      ["tasks.setParent", { taskId: t.subtaskA, parentId: null }, "taskId"],
      [
        "tasks.setParent",
        { taskId: board.childB, parentId: board.parentA },
        "parentId",
      ],
    ]);

    expect([await stateOf(f.workspaceA), await stateOf(f.workspaceB)]).toEqual(
      before,
    );
  });

  it("tasks.addRelation et tasks.removeRelation depuis ou vers une tâche de A, et sur la relation existante de A → not_found, comme un identifiant inexistant ; A et B inchangés", async () => {
    const before = [await stateOf(f.workspaceA), await stateOf(f.workspaceB)];
    const attempts: [string, Record<string, unknown>, string][] = [];
    for (const name of ["tasks.addRelation", "tasks.removeRelation"]) {
      for (const kind of ["blocks", "blocked_by", "related"]) {
        attempts.push(
          [
            name,
            { taskId: board.blockerA, kind, otherTaskId: board.loneB },
            "taskId",
          ],
          [
            name,
            { taskId: board.loneB, kind, otherTaskId: board.blockedA },
            "otherTaskId",
          ],
          [
            name,
            { taskId: board.blockerA, kind, otherTaskId: board.blockedA },
            "taskId",
          ],
        );
      }
    }

    await expectNotFoundLikeUnknown(attempts);

    expect([await stateOf(f.workspaceA), await stateOf(f.workspaceB)]).toEqual(
      before,
    );
    expect(await relationsBetween(board.blockerA, board.blockedA)).toHaveLength(
      1,
    );
  });

  it("tasks.listBoard de B ne rend aucune carte de A, ni du côté de A, ni avec l'espace de A (même réponse qu'un espace inexistant)", async () => {
    const list = (params: Record<string, unknown>) =>
      run(f.userB, f.workspaceB, "tasks.listBoard", params);
    const { tasks: tasksOfA } = await stateOf(f.workspaceA);

    const ownSide = await list({ side: "pro" });
    const sideOfA = await list({ side: "private" });
    const spaceOfA = await list({ side: "private", contextId: f.contextA });
    const proSpaceOfA = await list({ side: "pro", contextId: f.contextA });
    const unknownSpace = await list({ side: "pro", contextId: randomUUID() });

    expect(cardsOf(ownSide)).toEqual(
      expect.arrayContaining([board.childB, board.loneB]),
    );
    for (const id of ids(tasksOfA as { id: string }[])) {
      expect(cardsOf(ownSide)).not.toContain(id);
    }
    expect(sideOfA).toEqual(EMPTY_BOARD);
    expect(spaceOfA).toEqual(EMPTY_BOARD);
    expect(proSpaceOfA).toEqual(EMPTY_BOARD);
    expect(unknownSpace).toEqual(EMPTY_BOARD);
  });
});
