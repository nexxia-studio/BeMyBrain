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
import {
  waitForLockWait,
  type LockType,
} from "../../../tests/factories/lock-wait";
import { insertTasks, type TaskRow } from "../../../tests/factories/tasks";
import { TaskError, type TaskErrorCode } from "./errors";
import {
  addTaskRelation,
  moveTaskToTrash,
  removeTaskRelation,
} from "./mutations";
import type { TaskRelationInput } from "./schemas";

// Relations entre tâches (addTaskRelation, removeTaskRelation) contre la branche Neon test : withUserDb réel
// en rôle app_backend (RLS et droits de colonne actifs), fixture préparée et relue par le propriétaire. Chaque
// test repart de workspaces sans tâche ni relation ; chaque jeu de données porte une tâche à la corbeille.

// Même délai que mutations.test.ts : plusieurs allers-retours Neon séquentiels par test.
vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/mutations-relations.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
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

type Seed = Omit<TaskRow, "side"> & { side?: TaskRow["side"] };
type Kind = TaskRelationInput["kind"];

const TRASHED_AT = "2026-11-18T10:00:00Z";

/** Tâches privées par défaut, plus une tâche à la corbeille. */
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
  return ids.slice(0, rows.length);
}

type Line = { from: string; to: string; kind: string };

/** Lignes de task_relations des deux workspaces de la fixture, lues par le propriétaire. */
async function lines(): Promise<Line[]> {
  const { rows } = await owner.query<Line>(
    `select from_task_id as "from", to_task_id as "to", kind from task_relations
     where workspace_id = any($1) order by kind, from_task_id, to_task_id`,
    [[f.workspaceA, f.workspaceB]],
  );
  return rows;
}

/** Relation posée par le propriétaire, hors mutation (état de départ d'un test). */
async function link(from: string, to: string, kind: "blocks" | "related") {
  await owner.query(
    "insert into task_relations (workspace_id, from_task_id, to_task_id, kind) values ($1, $2, $3, $4)",
    [f.workspaceA, from, to, kind],
  );
}

function add(taskId: string, kind: Kind, otherTaskId: string) {
  return asA((tx) =>
    addTaskRelation(f.workspaceA, { taskId, kind, otherTaskId }, tx),
  );
}

function remove(taskId: string, kind: Kind, otherTaskId: string) {
  return asA((tx) =>
    removeTaskRelation(f.workspaceA, { taskId, kind, otherTaskId }, tx),
  );
}

/** Deux identifiants qui ne diffèrent que par leur dernier chiffre : `a` puis `b`. */
function orderedIds(): [string, string] {
  const stem = randomUUID().slice(0, -1);
  return [`${stem}a`, `${stem}b`];
}

describe("addTaskRelation : rangement", () => {
  it("blocks range (from = la tâche, to = l'autre) et renvoie le détail de la tâche", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);

    const detail = await add(task!, "blocks", other!);

    expect(await lines()).toEqual([{ from: task, to: other, kind: "blocks" }]);
    expect(detail).toMatchObject({ id: task });
  });

  it("blocked_by range la relation dans l'autre sens", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);

    const detail = await add(task!, "blocked_by", other!);

    expect(await lines()).toEqual([{ from: other, to: task, kind: "blocks" }]);
    expect(detail).toMatchObject({ id: task });
  });

  it("related rangée une seule fois, plus petit identifiant d'abord, quel que soit l'ordre des arguments", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: high, title: "Grande" },
      { id: low, title: "Petite" },
    ]);

    await add(high, "related", low);
    await add(low, "related", high);

    expect(await lines()).toEqual([{ from: low, to: high, kind: "related" }]);
  });

  it("related avec des identifiants en majuscules : même ligne, ordre des uuid de Postgres", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);

    // Comparées telles quelles, « …a » et « …B » s'ordonneraient à l'envers (B majuscule avant a minuscule).
    await add(low, "related", high.toUpperCase());
    await add(high.toUpperCase(), "related", low);
    await add(low.toUpperCase(), "related", high);

    expect(await lines()).toEqual([{ from: low, to: high, kind: "related" }]);
  });

  it("blocks avec des identifiants en majuscules : même ligne", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);

    await add(task!.toUpperCase(), "blocks", other!.toUpperCase());

    expect(await lines()).toEqual([{ from: task, to: other, kind: "blocks" }]);
  });

  it("relation déjà présente : une seule ligne, pas d'erreur, sous les deux formulations", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);
    await add(task!, "blocks", other!);

    const again = await add(task!, "blocks", other!);
    const mirrored = await add(other!, "blocked_by", task!);

    expect(await lines()).toEqual([{ from: task, to: other, kind: "blocks" }]);
    expect(again).toMatchObject({ id: task });
    expect(mirrored).toMatchObject({ id: other });
  });

  it("blocks puis related sur la même paire : deux lignes", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);

    await add(high, "blocks", low);
    await add(high, "related", low);

    expect(await lines()).toEqual([
      { from: high, to: low, kind: "blocks" },
      { from: low, to: high, kind: "related" },
    ]);
  });

  it("une sous-tâche bloque sa parente, et une parente bloque sa sous-tâche", async () => {
    const [parent, otherParent] = await seed([
      { title: "Parente" },
      { title: "Autre parente" },
    ]);
    const [sub, otherSub] = await seed([
      { title: "Sous-tâche", parentId: parent },
      { title: "Autre sous-tâche", parentId: otherParent },
    ]);

    await add(sub!, "blocks", parent!);
    await add(otherParent!, "blocks", otherSub!);

    expect(await lines()).toEqual(
      expect.arrayContaining([
        { from: sub, to: parent, kind: "blocks" },
        { from: otherParent, to: otherSub, kind: "blocks" },
      ]),
    );
    expect(await lines()).toHaveLength(2);
  });
});

describe("addTaskRelation : refus, rien n'est écrit", () => {
  it("inverse direct d'un blocage existant : relation_conflict, sous les deux formulations", async () => {
    const [a, b] = await seed([{ title: "A" }, { title: "B" }]);
    await add(a!, "blocks", b!);

    await expectCode(add(b!, "blocks", a!), "relation_conflict");
    await expectCode(add(a!, "blocked_by", b!), "relation_conflict");

    expect(await lines()).toEqual([{ from: a, to: b, kind: "blocks" }]);
  });

  // Limite assumée (spec, « Hors périmètre ») : seul l'inverse direct est refusé. Ce test documente l'état
  // d'aujourd'hui ; détection des cycles longs : ticket BRAIN-63. À retourner quand le ticket sera fait.
  it("boucle de trois (A bloque B, B bloque C, C bloque A) : acceptée aujourd'hui, trois lignes", async () => {
    const [a, b, c] = await seed([
      { title: "A" },
      { title: "B" },
      { title: "C" },
    ]);
    await add(a!, "blocks", b!);
    await add(b!, "blocks", c!);

    const closing = await codeOf(add(c!, "blocks", a!));

    expect(closing).toBeNull();
    expect(await lines()).toHaveLength(3);
    expect(await lines()).toEqual(
      expect.arrayContaining([
        { from: a, to: b, kind: "blocks" },
        { from: b, to: c, kind: "blocks" },
        { from: c, to: a, kind: "blocks" },
      ]),
    );
  });

  it("côtés différents : cross_side_relation, pour les trois types", async () => {
    const [task, other] = await seed([
      { title: "Tâche privée" },
      { title: "Tâche pro", side: "pro" },
    ]);

    await expectCode(add(task!, "blocks", other!), "cross_side_relation");
    await expectCode(add(task!, "blocked_by", other!), "cross_side_relation");
    await expectCode(add(other!, "related", task!), "cross_side_relation");

    expect(await lines()).toEqual([]);
  });

  it("elle-même, casse ignorée : invalid_params", async () => {
    const [task] = await seed([{ title: "Tâche" }]);

    await expectCode(add(task!, "blocks", task!), "invalid_params");
    await expectCode(
      add(task!, "related", task!.toUpperCase()),
      "invalid_params",
    );

    expect(await lines()).toEqual([]);
  });

  it("tâche à la corbeille : not_found, avant tout autre contrôle", async () => {
    const [other, trashed] = await seed([
      { title: "Autre" },
      { title: "Tâche jetée", deletedAt: TRASHED_AT },
    ]);

    await expectCode(add(trashed!, "blocks", other!), "not_found");
    await expectCode(add(trashed!, "related", trashed!), "not_found");

    expect(await lines()).toEqual([]);
  });

  it("autre tâche à la corbeille : not_found", async () => {
    const [task, trashed] = await seed([
      { title: "Tâche" },
      { title: "Autre jetée", deletedAt: TRASHED_AT },
    ]);

    await expectCode(add(task!, "blocks", trashed!), "not_found");
    await expectCode(add(task!, "related", trashed!), "not_found");

    expect(await lines()).toEqual([]);
  });

  it("autre tâche d'un autre workspace : not_found, comme un identifiant inexistant, rien d'écrit nulle part", async () => {
    const [task] = await seed([{ title: "Tâche" }]);
    const [foreign] = await seed(
      [{ title: "Tâche de B" }],
      f.workspaceB,
      f.userB,
    );

    const outcomes = await Promise.all(
      [foreign!, randomUUID()].map(async (otherTaskId) => {
        try {
          await add(task!, "blocks", otherTaskId);
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
    expect(await lines()).toEqual([]);
  });

  it("tâche d'un autre workspace : not_found, rien d'écrit nulle part", async () => {
    const [other] = await seed([{ title: "Autre" }]);
    const [foreign, foreignOther] = await seed(
      [{ title: "Tâche de B" }, { title: "Autre de B" }],
      f.workspaceB,
      f.userB,
    );

    await expectCode(add(foreign!, "blocked_by", other!), "not_found");
    await expectCode(add(foreign!, "related", foreignOther!), "not_found");

    expect(await lines()).toEqual([]);
  });

  it("type inconnu, clé inconnue ou champ absent : invalid_params", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);
    const call = (input: unknown) =>
      asA((tx) => addTaskRelation(f.workspaceA, input as never, tx));

    await expectCode(
      call({ taskId: task, kind: "duplicates", otherTaskId: other }),
      "invalid_params",
    );
    await expectCode(call({ taskId: task, kind: "blocks" }), "invalid_params");
    await expectCode(
      call({
        taskId: task,
        kind: "blocks",
        otherTaskId: other,
        workspaceId: f.workspaceB,
      }),
      "invalid_params",
    );

    expect(await lines()).toEqual([]);
  });
});

describe("removeTaskRelation", () => {
  it("blocked_by retire la ligne « l'autre bloque la tâche », pas l'inverse", async () => {
    const [a, b] = await seed([{ title: "A" }, { title: "B" }]);
    // Les deux sens ne coexistent que posés hors mutation : ils montrent quelle ligne part.
    await link(a!, b!, "blocks");
    await link(b!, a!, "blocks");

    const detail = await remove(a!, "blocked_by", b!);

    expect(await lines()).toEqual([{ from: a, to: b, kind: "blocks" }]);
    expect(detail).toMatchObject({ id: a });
  });

  it("blocks retire la ligne « la tâche bloque l'autre » et laisse related", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);
    await link(high, low, "blocks");
    await link(low, high, "related");

    await remove(high.toUpperCase(), "blocks", low);

    expect(await lines()).toEqual([{ from: low, to: high, kind: "related" }]);
  });

  it("related retirée quel que soit l'ordre des arguments et la casse", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);
    await link(low, high, "related");

    await remove(high.toUpperCase(), "related", low);

    expect(await lines()).toEqual([]);
  });

  it("relation absente : not_found, l'autre sens et l'autre type restent", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);
    await link(low, high, "blocks");
    await link(low, high, "related");

    await expectCode(remove(low, "blocked_by", high), "not_found");
    await expectCode(remove(high, "blocks", low), "not_found");

    expect(await lines()).toHaveLength(2);
  });

  it("relation devenue transversale (côtés différents) : retrait accepté", async () => {
    const [task, other] = await seed([
      { title: "Tâche privée" },
      { title: "Tâche passée pro", side: "pro" },
    ]);
    await link(task!, other!, "blocks");

    await remove(other!, "blocked_by", task!);

    expect(await lines()).toEqual([]);
  });

  it("elle-même : invalid_params ; tâche ou autre tâche à la corbeille, ou d'un autre workspace : not_found", async () => {
    const [task, trashed] = await seed([
      { title: "Tâche" },
      { title: "Jetée reliée", deletedAt: TRASHED_AT },
    ]);
    const [foreign] = await seed(
      [{ title: "Tâche de B" }],
      f.workspaceB,
      f.userB,
    );
    await link(task!, trashed!, "blocks");

    await expectCode(remove(task!, "blocks", task!), "invalid_params");
    await expectCode(remove(task!, "blocks", trashed!), "not_found");
    await expectCode(remove(trashed!, "blocked_by", task!), "not_found");
    await expectCode(remove(task!, "blocks", foreign!), "not_found");
    await expectCode(remove(foreign!, "blocks", task!), "not_found");

    expect(await lines()).toEqual([
      { from: task, to: trashed, kind: "blocks" },
    ]);
  });
});

/**
 * Lance `second` pendant que `first` tient sa transaction ouverte, attend que `second` patiente sur un verrou
 * de ce type, puis valide `first`. Les deux promesses sont toujours attendues.
 */
async function race(
  first: (tx: Parameters<Parameters<typeof asA>[0]>[0]) => Promise<unknown>,
  second: (tx: Parameters<Parameters<typeof asA>[0]>[0]) => Promise<unknown>,
  locktype: LockType,
): Promise<{
  first: string | null;
  second: string | null;
  blocked: boolean;
}> {
  let commitFirst = () => {};
  const gate = new Promise<void>((resolve) => (commitFirst = resolve));
  let firstWritten = () => {};
  const written = new Promise<void>((resolve) => (firstWritten = resolve));
  let setPid: (pid: number) => void = () => {};
  const pid = new Promise<number>((resolve) => (setPid = resolve));

  const firstDone = codeOf(
    asA(async (tx) => {
      await first(tx);
      firstWritten();
      await gate;
    }),
  );
  let secondDone: Promise<string | null> = Promise.resolve("non lancée");
  let blocked = false;
  try {
    await Promise.race([written, firstDone]);
    secondDone = codeOf(
      asA(async (tx) => {
        const { rows } = await tx.execute<{ pid: number }>(
          sql`select pg_backend_pid() as pid`,
        );
        setPid(rows[0]!.pid);
        await second(tx);
      }),
    );
    blocked = await waitForLockWait(owner, await pid, locktype);
  } finally {
    commitFirst();
    // Toujours attendues (elles ne rejettent pas) : aucune transaction ne déborde sur le test suivant.
    await Promise.all([firstDone, secondDone]);
  }
  return { first: await firstDone, second: await secondDone, blocked };
}

describe("relations : deux connexions", () => {
  it("A bloque B pendant que B bloque A : le second attend, un seul passe, l'autre reçoit relation_conflict", async () => {
    const [a, b] = await seed([{ title: "A" }, { title: "B" }]);

    const outcome = await race(
      (tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: a!, kind: "blocks", otherTaskId: b! },
          tx,
        ),
      (tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: b!, kind: "blocks", otherTaskId: a! },
          tx,
        ),
      "advisory",
    );

    expect(outcome).toEqual({
      first: null,
      second: "relation_conflict",
      blocked: true,
    });
    expect(await lines()).toEqual([{ from: a, to: b, kind: "blocks" }]);
  });

  it("A bloque B pendant que A est bloquée par B : le second attend, un seul passe, l'autre reçoit relation_conflict", async () => {
    const [a, b] = await seed([{ title: "A" }, { title: "B" }]);

    const outcome = await race(
      (tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: a!, kind: "blocks", otherTaskId: b! },
          tx,
        ),
      (tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: a!, kind: "blocked_by", otherTaskId: b! },
          tx,
        ),
      "advisory",
    );

    expect(outcome).toEqual({
      first: null,
      second: "relation_conflict",
      blocked: true,
    });
    expect(await lines()).toEqual([{ from: a, to: b, kind: "blocks" }]);
  });

  it("mise à la corbeille de l'autre tâche en cours : l'ajout attend, puis not_found, aucune relation", async () => {
    const [task, other] = await seed([{ title: "Tâche" }, { title: "Autre" }]);

    const outcome = await race(
      (tx) => moveTaskToTrash(f.workspaceA, other!, tx),
      (tx) =>
        addTaskRelation(
          f.workspaceA,
          { taskId: task!, kind: "blocks", otherTaskId: other! },
          tx,
        ),
      "advisory",
    );

    expect(outcome).toEqual({
      first: null,
      second: "not_found",
      blocked: true,
    });
    expect(await lines()).toEqual([]);
  });

  it("autre tâche jetée par une écriture hors verrou d'ordre : l'ajout attend sa ligne, puis not_found", async () => {
    const [low, high] = orderedIds();
    await seed([
      { id: low, title: "Petite" },
      { id: high, title: "Grande" },
    ]);
    let setPid: (pid: number) => void = () => {};
    const pid = new Promise<number>((resolve) => (setPid = resolve));
    // Pool à part : celui du propriétaire n'a qu'une connexion, que la sonde de verrous utilise.
    const outsidePool = createOwnerPool(ownerUrl!);
    const outside = await outsidePool.connect();
    let waitedForRow = false;
    let adding: Promise<string | null> = Promise.resolve("non lancée");

    try {
      // Écriture hors verrou, encore ouverte, sur la seconde ligne que l'ajout verrouille.
      await outside.query("begin");
      await outside.query("update tasks set deleted_at = now() where id = $1", [
        high,
      ]);
      adding = codeOf(
        asA(async (tx) => {
          const { rows } = await tx.execute<{ pid: number }>(
            sql`select pg_backend_pid() as pid`,
          );
          setPid(rows[0]!.pid);
          await addTaskRelation(
            f.workspaceA,
            { taskId: low, kind: "blocked_by", otherTaskId: high },
            tx,
          );
        }),
      );
      waitedForRow = await waitForLockWait(owner, await pid, "transactionid");
      await outside.query("commit");
    } finally {
      await outside.query("rollback").catch(() => undefined);
      outside.release();
      await outsidePool.end();
      await adding;
    }

    expect(await adding).toBe("not_found");
    expect(waitedForRow).toBe(true);
    expect(await lines()).toEqual([]);
  });
});
