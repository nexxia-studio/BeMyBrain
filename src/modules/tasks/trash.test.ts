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
import { TaskError, type TaskErrorCode } from "./errors";
import { moveTaskToTrash, restoreTask } from "./mutations";

// Corbeille et restauration contre la branche Neon test : withUserDb réel en rôle app_backend (RLS et droits
// de colonne actifs), fixture préparée et relue par le propriétaire (il voit aussi la corbeille).

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/trash.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
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

/** deleted_at en texte : la précision de la base (microsecondes), qu'un Date JS perdrait. */
async function deletedAtOf(id: string): Promise<string | null> {
  const { rows } = await owner.query<{ deleted_at: string | null }>(
    "select deleted_at::text as deleted_at from tasks where id = $1",
    [id],
  );
  return rows[0].deleted_at;
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

const earlier = "2026-11-18T10:00:00Z";

/** Parente active de A avec une sous-tâche active et une sous-tâche mise à la corbeille seule, avant. */
async function familyInA() {
  const [parent] = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "Parente", contextId: f.contextA },
  ]);
  const [active, trashedAlone] = await insertTasks(
    owner,
    f.workspaceA,
    f.userA,
    [
      {
        side: "private",
        title: "Sous active",
        parentId: parent,
        contextId: f.contextA,
      },
      {
        side: "private",
        title: "Sous jetée seule",
        parentId: parent,
        contextId: f.contextA,
        deletedAt: earlier,
      },
    ],
  );
  return { parent, active, trashedAlone };
}

describe("moveTaskToTrash", () => {
  it("la parente et ses sous-tâches actives reçoivent le même horodatage", async () => {
    const { parent, active, trashedAlone } = await familyInA();
    const before = await deletedAtOf(trashedAlone);

    await asA((tx) => moveTaskToTrash(f.workspaceA, parent, tx));

    const stamp = await deletedAtOf(parent);
    expect(stamp).not.toBeNull();
    expect(await deletedAtOf(active)).toBe(stamp);
    expect(await deletedAtOf(trashedAlone)).toBe(before);
  });

  it("une sous-tâche seule part à la corbeille sans sa parente ni sa sœur", async () => {
    const { parent, active, trashedAlone } = await familyInA();
    const sister = await deletedAtOf(trashedAlone);

    await asA((tx) => moveTaskToTrash(f.workspaceA, active, tx));

    expect(await deletedAtOf(active)).not.toBeNull();
    expect(await deletedAtOf(parent)).toBeNull();
    expect(await deletedAtOf(trashedAlone)).toBe(sister);
  });

  it("tâche déjà à la corbeille → not_found, horodatage gardé", async () => {
    const before = await deletedAtOf(t.trashedTaskA);

    await expectCode(
      asA((tx) => moveTaskToTrash(f.workspaceA, t.trashedTaskA, tx)),
      "not_found",
    );

    expect(await deletedAtOf(t.trashedTaskA)).toBe(before);
  });

  it("tâche de B, avec le workspace de A ou celui de B → not_found, B inchangée", async () => {
    for (const workspace of [f.workspaceA, f.workspaceB]) {
      await expectCode(
        asA((tx) => moveTaskToTrash(workspace, t.taskB, tx)),
        "not_found",
      );
    }

    expect(await deletedAtOf(t.taskB)).toBeNull();
    expect(await deletedAtOf(t.subtaskB)).toBeNull();
  });

  it("identifiant invalide → invalid_params", async () => {
    await expectCode(
      asA((tx) => moveTaskToTrash(f.workspaceA, "pas-un-uuid", tx)),
      "invalid_params",
    );
  });
});

describe("restoreTask", () => {
  it("la restauration ne ramène que les sous-tâches de cet horodatage", async () => {
    const { parent, active, trashedAlone } = await familyInA();
    await asA((tx) => moveTaskToTrash(f.workspaceA, parent, tx));
    const before = await deletedAtOf(trashedAlone);

    const task = await asA((tx) => restoreTask(f.workspaceA, parent, tx));

    expect(task.id).toBe(parent);
    expect(task.subtasks.map((s) => s.id)).toEqual([active]);
    expect(await deletedAtOf(parent)).toBeNull();
    expect(await deletedAtOf(active)).toBeNull();
    expect(await deletedAtOf(trashedAlone)).toBe(before);
  });

  it("sous-tâche dont la parente est à la corbeille → parent_in_trash, rien de changé", async () => {
    const { parent, active } = await familyInA();
    await asA((tx) => moveTaskToTrash(f.workspaceA, parent, tx));
    const stamp = await deletedAtOf(active);

    await expectCode(
      asA((tx) => restoreTask(f.workspaceA, active, tx)),
      "parent_in_trash",
    );

    expect(await deletedAtOf(active)).toBe(stamp);
    expect(await deletedAtOf(parent)).toBe(stamp);
  });

  it("sous-tâche jetée seule, parente active : restaurée seule", async () => {
    const { parent, trashedAlone } = await familyInA();

    const task = await asA((tx) => restoreTask(f.workspaceA, trashedAlone, tx));

    expect(task.id).toBe(trashedAlone);
    expect(await deletedAtOf(trashedAlone)).toBeNull();
    expect(await deletedAtOf(parent)).toBeNull();
  });

  it("tâche active : rien à restaurer, détail renvoyé tel quel", async () => {
    const { parent, trashedAlone } = await familyInA();
    const sister = await deletedAtOf(trashedAlone);

    const task = await asA((tx) => restoreTask(f.workspaceA, parent, tx));

    expect(task.id).toBe(parent);
    expect(await deletedAtOf(trashedAlone)).toBe(sister);
  });

  it("tâche de B à la corbeille, avec le workspace de A ou celui de B → not_found, B inchangée", async () => {
    await owner.query(
      "update tasks set deleted_at = $2 where id = $1 or parent_id = $1",
      [t.taskB, earlier],
    );
    const before = await deletedAtOf(t.taskB);

    for (const workspace of [f.workspaceA, f.workspaceB]) {
      await expectCode(
        asA((tx) => restoreTask(workspace, t.taskB, tx)),
        "not_found",
      );
    }

    expect(await deletedAtOf(t.taskB)).toBe(before);
    expect(await deletedAtOf(t.subtaskB)).toBe(before);
    await owner.query(
      "update tasks set deleted_at = null where id = $1 or parent_id = $1",
      [t.taskB],
    );
  });

  it("identifiant invalide → invalid_params", async () => {
    await expectCode(
      asA((tx) => restoreTask(f.workspaceA, "pas-un-uuid", tx)),
      "invalid_params",
    );
  });
});
