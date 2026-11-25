// @vitest-environment node
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
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
import { waitForLockWait } from "../../../tests/factories/lock-wait";
import {
  insertTags,
  insertTasks,
  type TaskRow,
} from "../../../tests/factories/tasks";
import { TaskError, type TaskErrorCode } from "./errors";
import { restoreTask, setTaskParent } from "./mutations";

// Tâche parente (setTaskParent, puis restoreTask) contre la branche Neon test : withUserDb réel en rôle
// app_backend (RLS et droits de colonne actifs), fixture préparée et relue par le propriétaire. Chaque test
// repart de workspaces sans tâche ; chaque jeu de données porte une tâche à la corbeille.

// Même délai que mutations.test.ts : plusieurs allers-retours Neon séquentiels par test.
vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/mutations-parent.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();
/** Second espace privé de A (contextA est privé lui aussi). */
const otherContext = randomUUID();
const TAG = `tag-parent-${f.run}`;

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await owner.query(
    "insert into contexts (id, workspace_id, name, kind, position) values ($1, $2, $3, 'private', 1)",
    [otherContext, f.workspaceA, `ctx-A2-${f.run}`],
  );
  await insertTags(owner, f.workspaceA, [TAG]);
});

beforeEach(async () => {
  const ids = [f.workspaceA, f.workspaceB];
  await owner.query("delete from task_relations where workspace_id = any($1)", [
    ids,
  ]);
  await owner.query("delete from task_tags where workspace_id = any($1)", [
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

/** Code du refus, ou null si l'écriture est passée. Une autre erreur ne sort que par son nom. */
async function codeOf(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof TaskError ? error.code : "autre erreur";
  }
}

async function expectCode(promise: Promise<unknown>, code: TaskErrorCode) {
  expect(await codeOf(promise)).toBe(code);
}

type Seed = Omit<TaskRow, "side"> & {
  side?: TaskRow["side"];
  sortKey?: string;
};

const TRASHED_AT = "2026-11-18T10:00:00Z";

/** Tâches privées et « À faire » par défaut, plus une tâche à la corbeille ; `updated_at` remis à vide. */
async function seed(
  rows: Seed[],
  workspace = f.workspaceA,
  user = f.userA,
): Promise<string[]> {
  const all = [...rows, { title: "Jetée", deletedAt: TRASHED_AT }];
  const ids = await insertTasks(
    owner,
    workspace,
    user,
    all.map((row) => ({ side: "private", ...row })),
  );
  for (const [index, row] of all.entries()) {
    await owner.query(
      "update tasks set sort_key = $2, updated_at = null where id = $1",
      [ids[index], ("sortKey" in row ? row.sortKey : undefined) ?? null],
    );
  }
  return ids.slice(0, rows.length);
}

type Row = {
  id: string;
  side: string;
  context_id: string | null;
  parent_id: string | null;
  status_category: string;
  sort_key: string | null;
  priority: number;
  deleted_at: string | null;
  updated_at: string | null;
  tags: string[];
  relations: number;
};

/** État d'une ligne, `updated_at` compris (toute réécriture se voit), avec ses tags et ses relations. */
async function row(id: string): Promise<Row> {
  const { rows } = await owner.query<Row>(
    `select t.id, t.side, t.context_id, t.parent_id, t.status_category, t.sort_key, t.priority,
       t.deleted_at::text, t.updated_at::text,
       array(select g.name from task_tags tt join tags g on g.id = tt.tag_id
             where tt.task_id = t.id order by g.name) as tags,
       (select count(*)::int from task_relations r
        where r.from_task_id = t.id or r.to_task_id = t.id) as relations
     from tasks t where t.id = $1`,
    [id],
  );
  return rows[0]!;
}

function setParent(
  taskId: string,
  parentId: string | null,
  workspace = f.workspaceA,
) {
  return asA((tx) => setTaskParent(workspace, { taskId, parentId }, tx));
}

function restore(taskId: string) {
  return asA((tx) => restoreTask(f.workspaceA, taskId, tx));
}

describe("setTaskParent : rattacher", () => {
  it("rattachée, elle prend l'espace de la parente et garde statut, place, priorité, tags et relations", async () => {
    const [parent, task, other] = await seed([
      { title: "Parente", contextId: otherContext },
      {
        title: "Tâche",
        contextId: f.contextA,
        statusCategory: "started",
        priority: 2,
        sortKey: "V",
        tags: [TAG],
      },
      { title: "Liée" },
    ]);
    await owner.query(
      "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, 'blocks')",
      [f.workspaceA, task, other],
    );
    const before = await row(task!);

    const detail = await setParent(task!, parent!);

    expect(await row(task!)).toEqual({
      ...before,
      parent_id: parent,
      context_id: otherContext,
      updated_at: expect.any(String),
    });
    expect(detail).toMatchObject({ id: task, parentId: parent });
    expect(detail).not.toHaveProperty("sortKey");
  });

  it("parente sans espace : la sous-tâche perd le sien", async () => {
    const [parent, task] = await seed([
      { title: "Parente" },
      { title: "Tâche", contextId: f.contextA },
    ]);

    await setParent(task!, parent!);

    expect(await row(task!)).toMatchObject({
      parent_id: parent,
      context_id: null,
    });
  });

  it("identifiants en majuscules : acceptés", async () => {
    const [parent, task] = await seed([
      { title: "Parente" },
      { title: "Tâche" },
    ]);

    await setParent(task!.toUpperCase(), parent!.toUpperCase());

    expect((await row(task!)).parent_id).toBe(parent);
  });

  it("même parente qu'avant : rien n'est écrit", async () => {
    const [parent] = await seed([{ title: "Parente" }]);
    const [sub] = await seed([{ title: "Sous-tâche", parentId: parent }]);
    const before = await row(sub!);

    const detail = await setParent(sub!, parent!.toUpperCase());

    expect(await row(sub!)).toEqual(before);
    expect(detail).toMatchObject({ id: sub, parentId: parent });
  });

  it("changement de parente : une seule écriture, l'espace suit la nouvelle parente", async () => {
    const [first, second] = await seed([
      { title: "Première parente", contextId: f.contextA },
      { title: "Seconde parente", contextId: otherContext },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche", parentId: first, contextId: f.contextA },
    ]);
    let writes = 0;

    await asA((tx) => {
      const update = vi.spyOn(tx, "update");
      const execute = vi.spyOn(tx, "execute");
      return setTaskParent(
        f.workspaceA,
        { taskId: sub!, parentId: second! },
        tx,
      ).finally(() => {
        // execute : seul le verrou d'ordre (un select) y passe, aucune écriture en SQL écrit.
        writes = update.mock.calls.length + execute.mock.calls.length - 1;
      });
    });

    expect(writes).toBe(1);
    expect(await row(sub!)).toMatchObject({
      parent_id: second,
      context_id: otherContext,
    });
  });

  it("tâche avec seulement des sous-tâches à la corbeille : acceptée", async () => {
    const [parent, task] = await seed([
      { title: "Parente" },
      { title: "Tâche" },
    ]);
    await seed([
      { title: "Sous-tâche jetée", parentId: task, deletedAt: TRASHED_AT },
    ]);

    await setParent(task!, parent!);

    expect((await row(task!)).parent_id).toBe(parent);
  });
});

describe("setTaskParent : refus, rien n'est écrit", () => {
  it("parente de l'autre côté : cross_side_parent", async () => {
    const [parent, task] = await seed([
      { title: "Parente pro", side: "pro" },
      { title: "Tâche", contextId: f.contextA },
    ]);
    const before = await row(task!);

    await expectCode(setParent(task!, parent!), "cross_side_parent");

    expect(await row(task!)).toEqual(before);
  });

  it("parente déjà sous-tâche : subtask_depth", async () => {
    const [top, task] = await seed([{ title: "Grande" }, { title: "Tâche" }]);
    const [sub] = await seed([{ title: "Sous-tâche", parentId: top }]);
    const before = await row(task!);

    await expectCode(setParent(task!, sub!), "subtask_depth");

    expect(await row(task!)).toEqual(before);
  });

  it("tâche avec une sous-tâche active : has_subtasks", async () => {
    const [parent, task] = await seed([
      { title: "Parente" },
      { title: "Tâche" },
    ]);
    await seed([{ title: "Sous-tâche", parentId: task }]);
    const before = await row(task!);

    await expectCode(setParent(task!, parent!), "has_subtasks");

    expect(await row(task!)).toEqual(before);
  });

  it("elle-même, casse ignorée : invalid_params", async () => {
    const [task] = await seed([{ title: "Tâche" }]);
    const before = await row(task!);

    await expectCode(setParent(task!, task!.toUpperCase()), "invalid_params");

    expect(await row(task!)).toEqual(before);
  });

  it("parente à la corbeille : parent_in_trash", async () => {
    const [task, parent] = await seed([
      { title: "Tâche" },
      { title: "Parente jetée", deletedAt: TRASHED_AT },
    ]);
    const before = await row(task!);

    await expectCode(setParent(task!, parent!), "parent_in_trash");

    expect(await row(task!)).toEqual(before);
  });

  it("parente d'un autre workspace : not_found, comme un identifiant inexistant", async () => {
    const [task] = await seed([{ title: "Tâche" }]);
    const [foreign] = await seed(
      [{ title: "Tâche de B" }],
      f.workspaceB,
      f.userB,
    );
    const before = await row(task!);

    const outcomes = await Promise.all(
      [foreign!, randomUUID()].map(async (parentId) => {
        try {
          await setParent(task!, parentId);
          return null;
        } catch (error) {
          const { name, code, message } = error as TaskError;
          return { name, code, message };
        }
      }),
    );

    expect(outcomes[0]).toEqual({
      name: "TaskError",
      code: "not_found",
      message: "not_found",
    });
    expect(outcomes[1]).toEqual(outcomes[0]);
    expect(await row(task!)).toEqual(before);
  });

  it("tâche d'un autre workspace : not_found, rien n'est écrit chez l'autre", async () => {
    const [parent] = await seed([{ title: "Parente" }]);
    const [foreign] = await seed(
      [{ title: "Tâche de B" }],
      f.workspaceB,
      f.userB,
    );
    const before = await row(foreign!);

    await expectCode(setParent(foreign!, parent!), "not_found");
    await expectCode(setParent(foreign!, null), "not_found");

    expect(await row(foreign!)).toEqual(before);
  });

  it("tâche à la corbeille : not_found, pour rattacher comme pour détacher", async () => {
    const [parent] = await seed([{ title: "Parente" }]);
    const [trashed] = await seed([
      { title: "Sous-tâche jetée", parentId: parent, deletedAt: TRASHED_AT },
    ]);
    const before = await row(trashed!);

    await expectCode(setParent(trashed!, parent!), "not_found");
    await expectCode(setParent(trashed!, null), "not_found");

    expect(await row(trashed!)).toEqual(before);
  });

  it("clé inconnue ou parentId absent : invalid_params", async () => {
    const [task] = await seed([{ title: "Tâche" }]);

    await expectCode(
      asA((tx) => setTaskParent(f.workspaceA, { taskId: task! } as never, tx)),
      "invalid_params",
    );
    await expectCode(
      asA((tx) =>
        setTaskParent(
          f.workspaceA,
          { taskId: task!, parentId: null, side: "pro" } as never,
          tx,
        ),
      ),
      "invalid_params",
    );
  });
});

describe("setTaskParent : détacher", () => {
  it("détachée, elle garde côté, espace, place, statut, priorité et tags", async () => {
    const [parent] = await seed([{ title: "Parente", contextId: f.contextA }]);
    const [sub] = await seed([
      {
        title: "Sous-tâche",
        parentId: parent,
        contextId: f.contextA,
        statusCategory: "started",
        priority: 3,
        sortKey: "j",
        tags: [TAG],
      },
    ]);
    const before = await row(sub!);

    const detail = await setParent(sub!, null);

    expect(await row(sub!)).toEqual({
      ...before,
      parent_id: null,
      updated_at: expect.any(String),
    });
    expect(detail).toMatchObject({ id: sub, parentId: null });
  });

  it("déjà de premier niveau : sans effet, sans erreur", async () => {
    const [task] = await seed([{ title: "Tâche", contextId: f.contextA }]);
    const before = await row(task!);

    const detail = await setParent(task!, null);

    expect(await row(task!)).toEqual(before);
    expect(detail).toMatchObject({ id: task, parentId: null });
  });
});

describe("setTaskParent : deux connexions", () => {
  it("A sous B pendant que B passe sous A : le second attend, un seul passe, ni cycle ni profondeur 2", async () => {
    const [a, b] = await seed([{ title: "A" }, { title: "B" }]);
    let commitFirst = () => {};
    const gate = new Promise<void>((resolve) => (commitFirst = resolve));
    let firstWritten = () => {};
    const written = new Promise<void>((resolve) => (firstWritten = resolve));
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));

    // Première transaction : A passe sous B, puis reste ouverte (non validée).
    const first = codeOf(
      asA(async (tx) => {
        await setTaskParent(f.workspaceA, { taskId: a!, parentId: b! }, tx);
        firstWritten();
        await gate;
      }),
    );
    let second: Promise<string | null> = Promise.resolve("non lancée");
    let blocked = false;
    try {
      await Promise.race([written, first]);
      second = codeOf(
        asA(async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await setTaskParent(f.workspaceA, { taskId: b!, parentId: a! }, tx);
        }),
      );
      blocked = await waitForLockWait(owner, await pid, "advisory");
    } finally {
      commitFirst();
    }

    expect(await first).toBeNull();
    expect(await second).toBe("subtask_depth");
    expect(blocked).toBe(true);
    expect((await row(a!)).parent_id).toBe(b);
    expect((await row(b!)).parent_id).toBeNull();
  });
});

describe("restoreTask : parente", () => {
  it("sous-tâche dont la parente est devenue sous-tâche : subtask_depth, elle reste à la corbeille", async () => {
    const [top, parent] = await seed([
      { title: "Grande" },
      { title: "Parente" },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche jetée", parentId: parent, deletedAt: TRASHED_AT },
    ]);
    await setParent(parent!, top!);
    const before = await row(sub!);

    await expectCode(restore(sub!), "subtask_depth");

    expect(await row(sub!)).toEqual(before);
  });

  it("après détachement de sa parente, la sous-tâche se restaure", async () => {
    const [top, parent] = await seed([
      { title: "Grande" },
      { title: "Parente" },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche jetée", parentId: parent, deletedAt: TRASHED_AT },
    ]);
    await setParent(parent!, top!);
    await setParent(parent!, null);

    await restore(sub!);

    expect(await row(sub!)).toMatchObject({
      parent_id: parent,
      deleted_at: null,
    });
  });

  it("sous-tâche qui a changé de parente : la nouvelle parente à la corbeille → parent_in_trash", async () => {
    const [first, second] = await seed([
      { title: "Première parente" },
      { title: "Seconde parente" },
    ]);
    const [sub] = await seed([{ title: "Sous-tâche", parentId: first }]);
    await setParent(sub!, second!);
    await owner.query(
      "update tasks set deleted_at = now() where id = any($1)",
      [[sub, second]],
    );

    await expectCode(restore(sub!), "parent_in_trash");

    expect((await row(sub!)).deleted_at).not.toBeNull();
  });

  it("parente changée entre la lecture et le verrou (écriture hors verrou d'ordre) : c'est la parente relue qui compte", async () => {
    const [first, second] = await seed([
      { title: "Première parente" },
      { title: "Seconde parente jetée", deletedAt: TRASHED_AT },
    ]);
    const [sub] = await seed([
      { title: "Sous-tâche jetée", parentId: first, deletedAt: TRASHED_AT },
    ]);
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));
    // Pool à part : celui du propriétaire n'a qu'une connexion, que la sonde de verrous utilise.
    const outsidePool = createOwnerPool(ownerUrl!);
    const outside = await outsidePool.connect();
    let waitedForRow = false;
    let restoring: Promise<string | null> = Promise.resolve("non lancée");

    try {
      // Écriture hors verrou, encore ouverte : la restauration lit l'ancienne parente, puis attend sa ligne.
      await outside.query("begin");
      await outside.query("update tasks set parent_id = $2 where id = $1", [
        sub,
        second,
      ]);
      await outside.query("select id from tasks where id = $1 for update", [
        first,
      ]);
      restoring = codeOf(
        asA(async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await restoreTask(f.workspaceA, sub!, tx);
        }),
      );
      waitedForRow = await waitForLockWait(owner, await pid, "transactionid");
      await outside.query("commit");
    } finally {
      await outside.query("rollback").catch(() => undefined);
      outside.release();
      await outsidePool.end();
    }

    expect(await restoring).toBe("parent_in_trash");
    expect(waitedForRow).toBe(true);
    expect((await row(sub!)).deleted_at).not.toBeNull();
  });
});
