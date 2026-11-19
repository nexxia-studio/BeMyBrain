// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

import { invokeAction, prepareAction, registry } from "./registry";

// Isolation du registre (constitution 5) contre la branche Neon test : withUserDb réel en rôle app_backend,
// actions du registre lancées pour un utilisateur avec le workspace d'un autre. Rien n'est lu ni écrit.

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


/** Tâches, tags et liens d'un workspace, lus en propriétaire (hors RLS), triés : témoin « rien de changé ». */
async function stateOf(workspaceId: string) {
  const tasks = await owner.query(
    `select id, title, status_category, priority, notes, due_date, deleted_at, side, context_id, completed_at,
       updated_at
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
  return { tasks: tasks.rows, tags: tags.rows, links: links.rows };
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
});
