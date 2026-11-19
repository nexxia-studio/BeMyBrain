import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";

import type { CoreFixture } from "./core";

// Tâches, sous-tâches, tags et liens des tests d'isolation, dans les deux workspaces d'une CoreFixture.
// Insérés avec le rôle propriétaire (DATABASE_TEST_URL), qui contourne la RLS : created_by est donc
// fourni explicitement (sans claims, app.current_user_id() est NULL). Nettoyés par deleteCoreFixture.

export type TasksFixture = {
  /** tâche privée de A, dans contextA, avec tagA */
  taskA: string;
  /** sous-tâche de taskA */
  subtaskA: string;
  /** tâche de A à la corbeille (deleted_at posé) */
  trashedTaskA: string;
  tagA: string;
  /** tâche pro de B, dans contextB, avec tagB */
  taskB: string;
  /** sous-tâche de taskB */
  subtaskB: string;
  tagB: string;
};

/** Identifiants générés avant toute insertion, comme newCoreFixture. */
export function newTasksFixture(): TasksFixture {
  return {
    taskA: randomUUID(),
    subtaskA: randomUUID(),
    trashedTaskA: randomUUID(),
    tagA: randomUUID(),
    taskB: randomUUID(),
    subtaskB: randomUUID(),
    tagB: randomUUID(),
  };
}

export async function insertTasksFixture(
  owner: Pool,
  core: CoreFixture,
  t: TasksFixture,
): Promise<void> {
  // contextA est privé, contextB est pro (insertCoreFixture).
  await owner.query(
    `insert into tasks (id, workspace_id, side, context_id, parent_id, title, origin, created_by, deleted_at)
     values
       ($1, $2, 'private', $3, null, 'Payer la crèche', 'app', $4, null),
       ($5, $2, 'private', $3, $1, 'Virement', 'app', $4, null),
       ($6, $2, 'private', null, null, 'Ancienne tâche', 'palette', $4, now()),
       ($7, $8, 'pro', $9, null, 'Relancer le devis', 'app', $10, null),
       ($11, $8, 'pro', $9, $7, 'Envoyer le PDF', 'app', $10, null)`,
    [
      t.taskA,
      core.workspaceA,
      core.contextA,
      core.userA,
      t.subtaskA,
      t.trashedTaskA,
      t.taskB,
      core.workspaceB,
      core.contextB,
      core.userB,
      t.subtaskB,
    ],
  );
  await owner.query(
    "insert into tags (id, workspace_id, name) values ($1, $2, $3), ($4, $5, $6)",
    [
      t.tagA,
      core.workspaceA,
      `tag-A-${core.run}`,
      t.tagB,
      core.workspaceB,
      `tag-B-${core.run}`,
    ],
  );
  await owner.query(
    "insert into task_tags (workspace_id, task_id, tag_id) values ($1, $2, $3), ($4, $5, $6)",
    [core.workspaceA, t.taskA, t.tagA, core.workspaceB, t.taskB, t.tagB],
  );
}

export type TaskRow = {
  id?: string;
  side: "private" | "pro";
  title: string;
  contextId?: string | null;
  parentId?: string | null;
  statusCategory?: string;
  priority?: number;
  dueDate?: string | null;
  dueTime?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  /** noms de tags déjà présents dans le workspace */
  tags?: string[];
};

/**
 * Ajoute des tâches à un workspace de la fixture, une par une (ordre de création = ordre du tableau),
 * avec leurs liens de tags (supprimées par deleteCoreFixture). Renvoie les ids dans l'ordre.
 */
export async function insertTasks(
  owner: Pool,
  workspaceId: string,
  createdBy: string,
  rows: TaskRow[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const row of rows) {
    const id = row.id ?? randomUUID();
    await owner.query(
      `insert into tasks (id, workspace_id, side, context_id, parent_id, title, status_category, priority,
         due_date, due_time, deleted_at, created_at, origin, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, coalesce($12::timestamptz, now()), 'app', $13)`,
      [
        id,
        workspaceId,
        row.side,
        row.contextId ?? null,
        row.parentId ?? null,
        row.title,
        row.statusCategory ?? "unstarted",
        row.priority ?? 0,
        row.dueDate ?? null,
        row.dueTime ?? null,
        row.deletedAt ?? null,
        row.createdAt ?? null,
        createdBy,
      ],
    );
    for (const name of row.tags ?? []) {
      await owner.query(
        `insert into task_tags (workspace_id, task_id, tag_id)
         select $1, $2, id from tags where workspace_id = $1 and lower(name) = lower($3)`,
        [workspaceId, id, name],
      );
    }
    ids.push(id);
  }
  return ids;
}

/** Ajoute des tags à un workspace de la fixture (supprimés par deleteCoreFixture). */
export async function insertTags(
  owner: Pool,
  workspaceId: string,
  names: string[],
): Promise<void> {
  for (const name of names) {
    await owner.query("insert into tags (workspace_id, name) values ($1, $2)", [
      workspaceId,
      name,
    ]);
  }
}
