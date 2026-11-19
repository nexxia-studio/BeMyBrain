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
  insertTasksFixture,
  newTasksFixture,
} from "../../../tests/factories/tasks";
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

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertTasksFixture(owner, f, t);
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

type TaskState = {
  title: string;
  status_category: string;
  deleted_at: Date | null;
  side: string;
  context_id: string | null;
};

/** État des tâches de B (taskB, subtaskB), lu en propriétaire. */
async function tasksOfB(): Promise<TaskState[]> {
  const { rows } = await owner.query<TaskState>(
    `select title, status_category, deleted_at, side, context_id from tasks
     where workspace_id = $1 order by title`,
    [f.workspaceB],
  );
  return rows;
}

async function countTasks(workspaceId: string): Promise<number> {
  const { rows } = await owner.query<{ n: number }>(
    "select count(*)::int as n from tasks where workspace_id = $1",
    [workspaceId],
  );
  return rows[0].n;
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("registre d'actions : isolation des actions tasks.*", () => {
  it("tasks.list, listDueToday, listTrash et listTags lancés par A ne renvoient rien de B", async () => {
    const list = (await run(f.userA, f.workspaceA, "tasks.list", {})) as {
      tasks: { id: string }[];
    };
    const due = (await run(
      f.userA,
      f.workspaceA,
      "tasks.listDueToday",
      {},
    )) as { id: string }[];
    const trash = (await run(f.userA, f.workspaceA, "tasks.listTrash", {})) as {
      id: string;
    }[];
    const tagList = (await run(f.userA, f.workspaceA, "tasks.listTags", {})) as {
      id: string;
    }[];

    expect(ids(list.tasks)).toEqual(
      expect.arrayContaining([t.taskA, t.subtaskA]),
    );
    expect(ids(trash)).toContain(t.trashedTaskA);
    expect(ids(tagList)).toContain(t.tagA);
    for (const found of [ids(list.tasks), ids(due), ids(trash), ids(tagList)]) {
      expect(found).not.toContain(t.taskB);
      expect(found).not.toContain(t.subtaskB);
      expect(found).not.toContain(t.tagB);
    }
  });

  it("tasks.list lancé par B sur le workspace de A ne renvoie rien", async () => {
    const result = await run(f.userB, f.workspaceA, "tasks.list", {});

    expect(result).toEqual({ tasks: [], truncated: false });
  });

  it("tasks.list de A avec le nom de l'espace de B → context_not_found", async () => {
    const attempt = run(f.userA, f.workspaceA, "tasks.list", {
      context: `ctx-B-${f.run}`,
    });

    await expect(attempt).rejects.toMatchObject({ code: "context_not_found" });
  });

  it("tasks.get, update, complete, moveToTrash et restore de A sur une tâche de B → not_found, rien de changé", async () => {
    const before = await tasksOfB();
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.get", { taskId: t.taskB }],
      ["tasks.update", { taskId: t.taskB, title: "intrus" }],
      ["tasks.update", { taskId: t.taskB, addTags: ["intrus"] }],
      ["tasks.complete", { taskId: t.taskB }],
      ["tasks.moveToTrash", { taskId: t.taskB }],
      ["tasks.restore", { taskId: t.taskB }],
    ];

    for (const [name, params] of attempts) {
      await expect(
        run(f.userA, f.workspaceA, name, params),
        name,
      ).rejects.toMatchObject({ code: "not_found" });
    }
    expect(await tasksOfB()).toEqual(before);
  });

  it("tasks.create de A sous une parente de B → not_found, rien d'écrit", async () => {
    const before = await countTasks(f.workspaceA);

    const attempt = run(f.userA, f.workspaceA, "tasks.create", {
      title: "intrus",
      parentId: t.taskB,
    });

    await expect(attempt).rejects.toMatchObject({ code: "not_found" });
    expect(await countTasks(f.workspaceA)).toBe(before);
    expect(await countTasks(f.workspaceB)).toBe(2);
  });

  it("tasks.create lancé par B sur le workspace de A est refusé par la RLS, rien d'écrit", async () => {
    const before = await countTasks(f.workspaceA);

    const attempt = run(f.userB, f.workspaceA, "tasks.create", {
      title: "intrus",
      side: "private",
    });

    await expect(attempt).rejects.toMatchObject({
      name: "DatabaseError",
      code: "42501",
    });
    expect(await countTasks(f.workspaceA)).toBe(before);
  });

  it("tasks.update de A avec le nom d'un tag de B crée un tag dans A, sans lier celui de B", async () => {
    await run(f.userA, f.workspaceA, "tasks.update", {
      taskId: t.taskA,
      addTags: [`tag-B-${f.run}`],
    });

    const { rows } = await owner.query<{ workspace_id: string }>(
      `select tg.workspace_id from task_tags tt join tags tg on tg.id = tt.tag_id
       where tt.task_id = $1 and lower(tg.name) = lower($2)`,
      [t.taskA, `tag-B-${f.run}`],
    );
    expect(rows).toEqual([{ workspace_id: f.workspaceA }]);
    const linksOfTagB = await owner.query(
      "select task_id from task_tags where tag_id = $1",
      [t.tagB],
    );
    expect(linksOfTagB.rows).toEqual([{ task_id: t.taskB }]);
  });
});
