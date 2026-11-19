import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { contexts } from "@/db/schema/core";
import { tags, tasks, taskTags } from "@/db/schema/tasks";
import { sideSchema, uuidSchema } from "@/modules/core/schemas";
import type { Side } from "@/modules/core/sides";

import {
  contextNameSchema,
  dueDateSchema,
  listTasksFilterSchema,
  openStatusCategories,
  parseTaskInput,
  statusCategorySchema,
  type ListTasksFilter,
  type StatusCategory,
} from "./schemas";

// Lectures du module tasks (ADR-004) : nommées, typées, réutilisables par l'assistant.
// Chaque fonction prend workspaceId en premier et la transaction de withUserDb (RLS active) en dernier,
// et filtre en plus sur workspaceId (double verrou, ADR-002).
// Corbeille : toutes partent du prédicat isActive ; seule listTrashedTasks lit les tâches à la corbeille.

/** Tâche active (hors corbeille) : seul prédicat de lecture, repris par mutations.ts. */
export const isActive: SQL = isNull(tasks.deletedAt);

export type Task = {
  id: string;
  side: Side;
  contextId: string | null;
  parentId: string | null;
  /** Titre de la parente active ; null pour une tâche de premier niveau. */
  parentTitle: string | null;
  title: string;
  statusCategory: StatusCategory;
  /** 0 aucune, 1 urgente, 2 haute, 3 moyenne, 4 basse. */
  priority: number;
  /** `YYYY-MM-DD`, jour local. */
  dueDate: string | null;
  /** `HH:MM`, heure locale. */
  dueTime: string | null;
  completedAt: Date | null;
  createdAt: Date;
  /** Noms des tags, triés sans tenir compte de la casse. */
  tags: string[];
  /** Sous-tâches actives comptées (annulées exclues) : dénominateur du compteur « n/m ». */
  subtaskTotal: number;
  /** Parmi elles, les terminées : numérateur du compteur. */
  subtaskDone: number;
};

export type TaskDetail = Task & {
  notes: string | null;
  /** Sous-tâches actives, par date de création. */
  subtasks: Task[];
};

export type TrashedTask = Task & { deletedAt: Date };

export type TaskList = { tasks: Task[]; truncated: boolean };

export type Tag = { id: string; name: string };

// Titre de la parente, si elle est active et du même workspace. Sous-requêtes corrélées : la ligne externe
// est écrite `tasks.<colonne>` en clair, car Drizzle rend `${tasks.id}` sans le nom de table dans une
// requête sans jointure (`"id"`, ambigu dans la sous-requête, 42702). Tables internes aliasées (p, tt, tg) :
// « tasks » y désigne donc bien la ligne externe.
const parentTitle = sql<string | null>`(
  select p.title from ${tasks} as p
  where p.workspace_id = tasks.workspace_id and p.id = tasks.parent_id and p.deleted_at is null
)`;

// Noms des tags de la tâche (liens et tags du même workspace, par FK composite et par filtre).
const tagNames = sql<string[]>`coalesce((
  select array_agg(tg.name order by lower(tg.name), tg.id)
  from ${taskTags} as tt
  join ${tags} as tg on tg.workspace_id = tt.workspace_id and tg.id = tt.tag_id
  where tt.workspace_id = tasks.workspace_id and tt.task_id = tasks.id
), '{}')`;

// Compteur « n/m » des sous-tâches actives (corbeille exclue), indépendant du filtre et du limit de la lecture.
// Règle du compteur, ici seulement (à valider par Antoine) : une sous-tâche annulée ne compte ni au numérateur
// ni au dénominateur ; « faite » = catégorie completed.
const countedSubtask = sql`s.status_category <> 'canceled'`;
const doneSubtask = sql`s.status_category = 'completed'`;

function subtaskCount(condition: SQL) {
  return sql<number>`(
    select count(*)::int from ${tasks} as s
    where s.workspace_id = tasks.workspace_id and s.parent_id = tasks.id and s.deleted_at is null
      and ${condition}
  )`;
}

const taskColumns = {
  id: tasks.id,
  side: tasks.side,
  contextId: tasks.contextId,
  parentId: tasks.parentId,
  parentTitle,
  title: tasks.title,
  statusCategory: tasks.statusCategory,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  dueTime: tasks.dueTime,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  tags: tagNames,
  subtaskTotal: subtaskCount(countedSubtask),
  subtaskDone: subtaskCount(sql`${countedSubtask} and ${doneSubtask}`),
};

// Ligne telle que la base la renvoie : side et statusCategory en text.
type TaskRow = Omit<Task, "side" | "statusCategory"> & {
  side: string;
  statusCategory: string;
};

function toTask(row: TaskRow): Task {
  return {
    ...row,
    // CHECK tasks_side_check et tasks_status_category_check ; validés quand même, pas de cast.
    side: sideSchema.parse(row.side),
    statusCategory: statusCategorySchema.parse(row.statusCategory),
    // time renvoyé en HH:MM:SS ; les secondes ne sont jamais saisies.
    dueTime: row.dueTime === null ? null : row.dueTime.slice(0, 5),
  };
}

// Échéance (sans échéance en dernier, heure avant « sans heure »), priorité (aucune en dernier), création.
const listOrder = [
  sql`${tasks.dueDate} asc nulls last`,
  sql`${tasks.dueTime} asc nulls last`,
  sql`case when ${tasks.priority} = 0 then 5 else ${tasks.priority} end`,
  asc(tasks.createdAt),
  asc(tasks.id),
];

/** Échappe `\`, `%` et `_` pour un motif ILIKE littéral (échappement `\`, déclaré dans la requête). */
function likeContains(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

function workspaceOf(workspaceId: string): string {
  return parseTaskInput(uuidSchema, workspaceId);
}

/**
 * Tâches actives (sous-tâches comprises) filtrées ; terminées et annulées exclues par défaut.
 * `truncated` : il existe d'autres tâches au-delà de `limit`.
 */
export async function listTasks(
  workspaceId: string,
  filter: ListTasksFilter,
  tx: UserTx,
): Promise<TaskList> {
  const workspace = workspaceOf(workspaceId);
  const f = parseTaskInput(listTasksFilterSchema, filter);
  const conditions: (SQL | undefined)[] = [
    eq(tasks.workspaceId, workspace),
    isActive,
    inArray(tasks.statusCategory, f.statusCategories),
    f.side === undefined ? undefined : eq(tasks.side, f.side),
    f.contextId === undefined ? undefined : eq(tasks.contextId, f.contextId),
    f.dueOnOrBefore === undefined
      ? undefined
      : lte(tasks.dueDate, f.dueOnOrBefore),
    f.query === undefined
      ? undefined
      : sql`${tasks.title} ilike ${likeContains(f.query)} escape '\\'`,
    f.tag === undefined
      ? undefined
      : sql`exists (
          select 1 from ${taskTags} as tt
          join ${tags} as tg on tg.workspace_id = tt.workspace_id and tg.id = tt.tag_id
          where tt.workspace_id = tasks.workspace_id and tt.task_id = tasks.id
            and lower(tg.name) = lower(${f.tag})
        )`,
  ];
  const rows = await tx
    .select(taskColumns)
    .from(tasks)
    .where(and(...conditions))
    .orderBy(...listOrder)
    .limit(f.limit + 1);
  return {
    tasks: rows.slice(0, f.limit).map(toTask),
    truncated: rows.length > f.limit,
  };
}

/** Une tâche active avec ses notes, ses tags et ses sous-tâches actives ; null si absente ou à la corbeille. */
export async function getTask(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TaskDetail | null> {
  const workspace = workspaceOf(workspaceId);
  const id = parseTaskInput(uuidSchema, taskId);
  const rows = await tx
    .select({ ...taskColumns, notes: tasks.notes })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), eq(tasks.id, id), isActive))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const subtasks = await tx
    .select(taskColumns)
    .from(tasks)
    .where(
      and(eq(tasks.workspaceId, workspace), eq(tasks.parentId, id), isActive),
    )
    .orderBy(asc(tasks.createdAt), asc(tasks.id));
  const { notes, ...task } = row;
  return { ...toTask(task), notes, subtasks: subtasks.map(toTask) };
}

/**
 * Tâches actives non terminées en retard ou dues `today` (jour local `YYYY-MM-DD`, calculé par l'appelant avec
 * `todayIn(getUserTimeZone(), now)`), des deux côtés, sous-tâches comprises.
 */
export async function listDueToday(
  workspaceId: string,
  today: string,
  tx: UserTx,
): Promise<Task[]> {
  const workspace = workspaceOf(workspaceId);
  const day = parseTaskInput(dueDateSchema, today);
  const rows = await tx
    .select(taskColumns)
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspace),
        isActive,
        inArray(tasks.statusCategory, [...openStatusCategories]),
        lte(tasks.dueDate, day),
      ),
    )
    .orderBy(...listOrder);
  return rows.map(toTask);
}

/** Corbeille : tâches à la corbeille (sous-tâches comprises), plus récentes d'abord. */
export async function listTrashedTasks(
  workspaceId: string,
  tx: UserTx,
): Promise<TrashedTask[]> {
  const workspace = workspaceOf(workspaceId);
  const rows = await tx
    .select({
      ...taskColumns,
      // Dans la corbeille, la parente est montrée même à la corbeille.
      parentTitle: sql<string | null>`(
        select p.title from ${tasks} as p
        where p.workspace_id = tasks.workspace_id and p.id = tasks.parent_id
      )`,
      // Non nul par le filtre isNotNull ci-dessous ; mapWith garde la conversion en Date de la colonne.
      deletedAt: sql<Date>`${tasks.deletedAt}`.mapWith(tasks.deletedAt),
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), isNotNull(tasks.deletedAt)))
    .orderBy(desc(tasks.deletedAt), asc(tasks.id));
  return rows.map(({ deletedAt, ...row }) => ({ ...toTask(row), deletedAt }));
}

/** Tags du workspace, triés sans tenir compte de la casse. */
export async function listTags(
  workspaceId: string,
  tx: UserTx,
): Promise<Tag[]> {
  const workspace = workspaceOf(workspaceId);
  return tx
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(eq(tags.workspaceId, workspace))
    .orderBy(sql`lower(${tags.name})`, asc(tags.id));
}

/**
 * Espace du workspace désigné par son nom exact (unique dans le workspace, contexts_workspace_name_unique),
 * du côté `side` s'il est donné ; null s'il n'existe pas. Sert à un appelant qui nomme un espace (modèle,
 * `context` des actions) : l'id n'est jamais demandé.
 */
export async function findContextByName(
  workspaceId: string,
  name: string,
  side: Side | undefined,
  tx: UserTx,
): Promise<{ id: string; side: Side } | null> {
  const workspace = workspaceOf(workspaceId);
  const contextName = parseTaskInput(contextNameSchema, name);
  const contextSide =
    side === undefined ? undefined : parseTaskInput(sideSchema, side);
  const rows = await tx
    .select({ id: contexts.id, kind: contexts.kind })
    .from(contexts)
    .where(
      and(
        eq(contexts.workspaceId, workspace),
        eq(contexts.name, contextName),
        contextSide === undefined ? undefined : eq(contexts.kind, contextSide),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? { id: row.id, side: sideSchema.parse(row.kind) } : null;
}
