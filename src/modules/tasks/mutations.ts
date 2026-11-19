import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import type { UserTx } from "@/db/client";
import { contexts } from "@/db/schema/core";
import { tags, tasks, taskTags } from "@/db/schema/tasks";
import { actionOrigins, type ActionOrigin } from "@/modules/actions/types";
import { sideSchema, uuidSchema } from "@/modules/core/schemas";
import type { Side } from "@/modules/core/sides";

import { TaskError } from "./errors";
import { getTask, isActive, type TaskDetail } from "./queries";
import {
  createTaskInputSchema,
  parseTaskInput,
  taskIdSchema,
  updateTaskInputSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "./schemas";

// Écritures du module tasks (ADR-002). Même contrat que queries.ts : workspaceId en premier, transaction de
// withUserDb (RLS active) en dernier, filtre explicite sur workspaceId en plus de la RLS.
// Une écriture ne touche qu'une tâche active (sauf restoreTask) : une tâche à la corbeille est not_found.
// Sous-tâches : côté et espace suivent toujours la parente. Changer ceux de la parente se fait en UNE
// instruction sur la parente et toutes ses sous-tâches (corbeille comprise) : la FK parente
// (workspace_id, parent_id, side), NO ACTION, est vérifiée en fin d'instruction, sur l'état cohérent ; et un
// espace commun à toute la famille laisse passer le ON UPDATE CASCADE d'un changement de kind de l'espace.
// INSERT en SQL écrit : Drizzle liste toutes les colonnes de la table (DEFAULT pour les absentes), or
// app_backend n'a le droit INSERT que sur certaines (created_by, id, created_at… sont posés par la base).

const originSchema = z.enum(actionOrigins);

const closedCategories = sql`('completed', 'canceled')`;

type LockedTask = {
  id: string;
  side: Side;
  contextId: string | null;
  parentId: string | null;
  dueDate: string | null;
  deleted: boolean;
};

/** Tâche du workspace verrouillée pour la transaction (corbeille comprise) ; null si absente. */
async function lockTask(
  workspace: string,
  id: string,
  tx: UserTx,
): Promise<LockedTask | null> {
  const rows = await tx
    .select({
      id: tasks.id,
      side: tasks.side,
      contextId: tasks.contextId,
      parentId: tasks.parentId,
      dueDate: tasks.dueDate,
      deleted: sql<boolean>`${tasks.deletedAt} is not null`,
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), eq(tasks.id, id)))
    .for("update");
  const row = rows[0];
  return row ? { ...row, side: sideSchema.parse(row.side) } : null;
}

/**
 * Espace du workspace désigné par son nom exact, du côté `side` s'il est donné. Le nom est unique dans le
 * workspace (contexts_workspace_name_unique). Absent → context_not_found.
 */
async function resolveContext(
  workspace: string,
  name: string,
  side: Side | undefined,
  tx: UserTx,
): Promise<{ id: string; side: Side }> {
  const rows = await tx
    .select({ id: contexts.id, kind: contexts.kind })
    .from(contexts)
    .where(
      and(
        eq(contexts.workspaceId, workspace),
        eq(contexts.name, name),
        side === undefined ? undefined : eq(contexts.kind, side),
      ),
    );
  const row = rows[0];
  if (!row) throw new TaskError("context_not_found");
  return { id: row.id, side: sideSchema.parse(row.kind) };
}

/** Prédicat SQL « lower(tags.name) parmi ces noms », comparés par lower() côté base. */
function tagNameIn(names: string[]): SQL {
  return sql`lower(${tags.name}) in (${sql.join(
    names.map((name) => sql`lower(${name})`),
    sql`, `,
  )})`;
}

/** Ajoute des tags à une tâche, en créant ceux qui n'existent pas ; un tag déjà porté reste unique. */
async function addTags(
  workspace: string,
  taskId: string,
  names: string[],
  tx: UserTx,
): Promise<void> {
  // ON CONFLICT DO NOTHING sans cible : aucune dépendance au nom ni aux colonnes des contraintes uniques
  // (tags_workspace_lower_name_unique, clé de task_tags), y compris entre deux lignes de la même instruction.
  await tx.execute(sql`
    insert into ${tags} (workspace_id, name)
    values ${sql.join(
      names.map((name) => sql`(${workspace}, ${name})`),
      sql`, `,
    )}
    on conflict do nothing`);
  await tx.execute(sql`
    insert into ${taskTags} (workspace_id, task_id, tag_id)
    select ${tags.workspaceId}, ${taskId}, ${tags.id} from ${tags}
    where ${tags.workspaceId} = ${workspace} and ${tagNameIn(names)}
    on conflict do nothing`);
}

/** Retire des tags d'une tâche ; un nom absent est ignoré. */
async function removeTags(
  workspace: string,
  taskId: string,
  names: string[],
  tx: UserTx,
): Promise<void> {
  await tx.delete(taskTags).where(
    and(
      eq(taskTags.workspaceId, workspace),
      eq(taskTags.taskId, taskId),
      sql`${taskTags.tagId} in (
        select ${tags.id} from ${tags} where ${tags.workspaceId} = ${workspace} and ${tagNameIn(names)}
      )`,
    ),
  );
}

/** Relit la tâche écrite (active) dans la même transaction. */
async function reload(
  workspace: string,
  id: string,
  tx: UserTx,
): Promise<TaskDetail> {
  const task = await getTask(workspace, id, tx);
  if (!task) throw new TaskError("not_found");
  return task;
}

/**
 * Crée une tâche ou une sous-tâche (`parentId`) et renvoie son détail. `origin` vient du point d'entrée
 * serveur (ActionContext.origin), jamais des paramètres ; `created_by` est posé par la base.
 * Tâche de premier niveau : côté donné, ou pris de l'espace (`context`, nom exact). Sous-tâche : côté et
 * espace de la parente ; les passer → subtask_follows_parent. Tags par nom, créés s'ils n'existent pas.
 */
export async function createTask(
  workspaceId: string,
  input: CreateTaskInput,
  origin: ActionOrigin,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const taskOrigin = parseTaskInput(originSchema, origin);
  const i = parseTaskInput(createTaskInputSchema, input);

  let side: Side;
  let contextId: string | null = null;
  if (i.parentId !== undefined) {
    if (i.side !== undefined || i.context !== undefined) {
      throw new TaskError("subtask_follows_parent");
    }
    // Verrou : la parente ne change ni de côté ni d'espace avant l'insertion.
    const parent = await lockTask(workspace, i.parentId, tx);
    if (!parent) throw new TaskError("not_found");
    if (parent.deleted) throw new TaskError("parent_in_trash");
    if (parent.parentId !== null) throw new TaskError("subtask_depth");
    side = parent.side;
    contextId = parent.contextId;
  } else if (i.context !== undefined) {
    const context = await resolveContext(workspace, i.context, i.side, tx);
    side = context.side;
    contextId = context.id;
  } else if (i.side !== undefined) {
    side = i.side;
  } else {
    throw new TaskError("invalid_params");
  }

  const status = i.statusCategory ?? "unstarted";
  const result = await tx.execute<{ id: string }>(sql`
    insert into ${tasks} (workspace_id, side, context_id, parent_id, title, notes, status_category, priority,
      due_date, due_time, completed_at, origin)
    values (${workspace}, ${side}, ${contextId}, ${i.parentId ?? null}, ${i.title}, ${i.notes ?? null},
      ${status}, ${i.priority ?? 0}, ${i.dueDate ?? null}, ${i.dueTime ?? null},
      case when ${status} in ${closedCategories} then now() end, ${taskOrigin})
    returning id`);
  const id = result.rows[0].id;
  if (i.tags !== undefined) await addTags(workspace, id, i.tags, tx);
  return reload(workspace, id, tx);
}

/**
 * Modifie une tâche active et renvoie son détail. Tags par `addTags` / `removeTags`, jamais de remplacement.
 * Côté et espace (refusés sur une sous-tâche) : un espace donne son côté ; un côté seul qui change retire
 * l'espace (un espace n'a qu'un côté). La parente et ses sous-tâches changent ensemble.
 * `completed_at` : posé au passage à completed ou canceled (gardé entre les deux), vidé sinon.
 */
export async function updateTask(
  workspaceId: string,
  input: UpdateTaskInput,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const {
    taskId,
    side,
    context,
    addTags: add,
    removeTags: remove,
    ...fields
  } = parseTaskInput(updateTaskInputSchema, input);
  const changes = Object.values({ side, context, add, remove, ...fields });
  if (changes.every((value) => value === undefined)) {
    throw new TaskError("invalid_params");
  }

  const task = await lockTask(workspace, taskId, tx);
  if (!task || task.deleted) throw new TaskError("not_found");
  if (task.parentId !== null && (side !== undefined || context !== undefined)) {
    throw new TaskError("subtask_follows_parent");
  }
  const dueDate = fields.dueDate === undefined ? task.dueDate : fields.dueDate;
  if (typeof fields.dueTime === "string" && dueDate === null) {
    throw new TaskError("invalid_params");
  }

  let placement: { side: Side; contextId: string | null } | null = null;
  if (typeof context === "string") {
    const resolved = await resolveContext(workspace, context, side, tx);
    placement = { side: resolved.side, contextId: resolved.id };
  } else if (context === null) {
    placement = { side: side ?? task.side, contextId: null };
  } else if (side !== undefined && side !== task.side) {
    placement = { side, contextId: null };
  }
  if (
    placement !== null &&
    (placement.side !== task.side || placement.contextId !== task.contextId)
  ) {
    // Une seule instruction pour la famille (voir en tête du fichier).
    await tx
      .update(tasks)
      .set(placement)
      .where(
        and(
          eq(tasks.workspaceId, workspace),
          or(eq(tasks.id, taskId), eq(tasks.parentId, taskId)),
        ),
      );
  }

  const { statusCategory, dueTime, ...rest } = fields;
  const set = {
    ...rest,
    // Date retirée → heure retirée (CHECK tasks_due_time_check).
    dueTime: fields.dueDate === null && dueTime === undefined ? null : dueTime,
    ...(statusCategory === undefined
      ? {}
      : {
          statusCategory,
          // Dans un SET, les colonnes valent l'état d'avant l'instruction.
          completedAt: sql`case when ${statusCategory} in ${closedCategories}
            then case when ${tasks.statusCategory} in ${closedCategories} then ${tasks.completedAt} else now() end
          end`,
        }),
  };
  if (Object.values(set).some((value) => value !== undefined)) {
    await tx
      .update(tasks)
      .set(set)
      .where(
        and(eq(tasks.workspaceId, workspace), eq(tasks.id, taskId), isActive),
      );
  }
  if (remove !== undefined) await removeTags(workspace, taskId, remove, tx);
  if (add !== undefined) await addTags(workspace, taskId, add, tx);
  return reload(workspace, taskId, tx);
}

/** Raccourci : passe une tâche active à completed (ses sous-tâches gardent leur catégorie). */
export function completeTask(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TaskDetail> {
  return updateTask(workspaceId, { taskId, statusCategory: "completed" }, tx);
}

export type TrashResult = {
  id: string;
  /** Sous-tâches actives mises à la corbeille avec elle (même horodatage). */
  subtaskCount: number;
};

/**
 * Met une tâche active à la corbeille (deleted_at, aucun DELETE). Parente : ses sous-tâches encore actives
 * reçoivent le même horodatage, en une instruction (now() = début de la transaction, identique pour toutes
 * les lignes) ; une sous-tâche déjà à la corbeille garde le sien. Absente, d'un autre workspace ou déjà à
 * la corbeille → not_found.
 */
export async function moveTaskToTrash(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TrashResult> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const id = parseTaskInput(taskIdSchema, taskId);

  // Verrou sur la tâche : même ordre que createTask (parente d'abord), aucune sous-tâche créée entre-temps.
  const task = await lockTask(workspace, id, tx);
  if (!task || task.deleted) throw new TaskError("not_found");

  const result = await tx.execute<{ id: string }>(sql`
    update ${tasks} set deleted_at = now()
    where workspace_id = ${workspace} and deleted_at is null and (id = ${id} or parent_id = ${id})
    returning id`);
  return { id, subtaskCount: result.rows.length - 1 };
}

/**
 * Restaure une tâche de la corbeille et renvoie son détail. Parente : seulement les sous-tâches qui portent
 * son horodatage (mises à la corbeille avec elle). Sous-tâche dont la parente est à la corbeille →
 * parent_in_trash. Tâche active : rien à faire, détail renvoyé. Absente ou d'un autre workspace → not_found.
 */
export async function restoreTask(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const id = parseTaskInput(taskIdSchema, taskId);

  // parent_id n'est jamais modifié (aucun droit UPDATE) : lu sans verrou, pour verrouiller la parente avant
  // la sous-tâche, dans l'ordre de moveTaskToTrash (pas d'interblocage avec une mise à la corbeille).
  const [found] = await tx
    .select({ parentId: tasks.parentId })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), eq(tasks.id, id)));
  if (!found) throw new TaskError("not_found");
  if (found.parentId !== null) {
    const parent = await lockTask(workspace, found.parentId, tx);
    if (!parent || parent.deleted) throw new TaskError("parent_in_trash");
  }
  const task = await lockTask(workspace, id, tx);
  if (!task) throw new TaskError("not_found");

  if (task.deleted) {
    // Horodatage comparé en base (microsecondes), pas via un Date JS (millisecondes). La sous-requête voit
    // l'état d'avant l'instruction.
    await tx.execute(sql`
      update ${tasks} set deleted_at = null
      where workspace_id = ${workspace} and (id = ${id} or (parent_id = ${id} and deleted_at = (
        select deleted_at from ${tasks} where workspace_id = ${workspace} and id = ${id}
      )))`);
  }
  return reload(workspace, id, tx);
}
