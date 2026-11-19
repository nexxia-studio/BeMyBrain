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
