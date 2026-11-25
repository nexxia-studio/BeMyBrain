import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { contexts } from "@/db/schema/core";
import { tags, taskRelations, tasks, taskTags } from "@/db/schema/tasks";
import type { ContextColor } from "@/modules/core/context-colors";
import {
  contextColorSchema,
  sideSchema,
  uuidSchema,
} from "@/modules/core/schemas";
import type { Side } from "@/modules/core/sides";

import {
  boardFilterSchema,
  contextNameSchema,
  dueDateSchema,
  listTasksFilterSchema,
  openStatusCategories,
  parseTaskInput,
  statusCategories,
  statusCategorySchema,
  upcomingTasksFilterSchema,
  type BoardFilter,
  type ListTasksFilter,
  type StatusCategory,
  type UpcomingTasksFilter,
} from "./schemas";
import { TASK_LIST_MAX_LIMIT } from "./sides";

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
  /** Nom de l'espace, pour un appelant qui désigne les espaces par leur nom (modèle) ; null sans espace. */
  contextName: string | null;
  /** Pastille de l'espace (DESIGN.md § 2) ; null sans espace. */
  contextColor: ContextColor | null;
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
  /** Sous-tâches actives encore ouvertes (backlog, unstarted, started). */
  subtaskOpen: number;
  /**
   * « Bloquée », dérivé à la lecture : la tâche est active et ouverte, et une tâche active, ouverte et du même
   * côté la bloque. Faux dès que la bloquante est terminée, annulée, à la corbeille ou de l'autre côté.
   */
  blocked: boolean;
};

/** L'autre tâche d'une relation, telle qu'une ligne du détail ou d'une liste de sélection la montre. */
export type TaskRelationItem = {
  /** Identifiant de l'autre tâche. */
  id: string;
  title: string;
  statusCategory: StatusCategory;
  contextName: string | null;
  contextColor: ContextColor | null;
};

/** Relations lues depuis la tâche ; l'autre bout est toujours actif et du même côté, par titre puis identifiant. */
export type TaskRelations = {
  /** Tâches que celle-ci bloque. */
  blocks: TaskRelationItem[];
  /** Tâches qui bloquent celle-ci (lecture inverse de `blocks`). */
  blockedBy: TaskRelationItem[];
  /** « Liée à », symétrique. */
  related: TaskRelationItem[];
};

export type TaskDetail = Task & {
  notes: string | null;
  /** Sous-tâches actives, par date de création. */
  subtasks: Task[];
  relations: TaskRelations;
};

export type TrashedTask = Task & { deletedAt: Date };

export type TaskList = { tasks: Task[]; truncated: boolean };

export type BoardColumn = {
  category: StatusCategory;
  /** Cartes dans l'ordre d'affichage, bornées par le plafond ou la limite de la colonne. */
  tasks: Task[];
  /** Nombre réel de tâches de la colonne dans le périmètre lu (côté, espace, options de sous-tâches). */
  total: number;
  /** Il existe d'autres tâches que celles rendues (`total` > cartes lues). */
  truncated: boolean;
};

/** Tableau : une colonne par catégorie de statut, dans l'ordre de `statusCategories`. */
export type Board = { columns: BoardColumn[] };

export type Tag = { id: string; name: string };

// Titre de la parente, si elle est active et du même workspace. Sous-requêtes corrélées : la ligne externe
// est écrite `tasks.<colonne>` en clair, car Drizzle rend `${tasks.id}` sans le nom de table dans une
// requête sans jointure (`"id"`, ambigu dans la sous-requête, 42702). Tables internes aliasées (p, tt, tg) :
// « tasks » y désigne donc bien la ligne externe.
const parentTitle = sql<string | null>`(
  select p.title from ${tasks} as p
  where p.workspace_id = tasks.workspace_id and p.id = tasks.parent_id and p.deleted_at is null
)`;

// Nom de l'espace de la tâche, borné au workspace de la ligne (même forme que parentTitle).
const contextName = sql<string | null>`(
  select c.name from ${contexts} as c
  where c.workspace_id = tasks.workspace_id and c.id = tasks.context_id
)`;

// Couleur de l'espace de la tâche (même forme que contextName).
const contextColor = sql<string | null>`(
  select c.color from ${contexts} as c
  where c.workspace_id = tasks.workspace_id and c.id = tasks.context_id
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

// Catégories ouvertes, en liste SQL : constantes du module (jamais une saisie), d'où sql.raw.
const openCategoriesSql = sql.raw(
  `(${openStatusCategories.map((category) => `'${category}'`).join(", ")})`,
);

// « Bloquée » : tâche active et ouverte, avec au moins une relation blocks dont la bloquante (b) est active,
// ouverte et du même côté. Workspace filtré des deux côtés de la jointure : une ligne de task_relations ne
// peut désigner qu'une bloquante du workspace de la tâche lue.
const blocked = sql<boolean>`(
  tasks.deleted_at is null and tasks.status_category in ${openCategoriesSql} and exists (
    select 1 from ${taskRelations} as r
    join ${tasks} as b on b.workspace_id = r.workspace_id and b.id = r.from_task_id
    where r.workspace_id = tasks.workspace_id and r.to_task_id = tasks.id and r.kind = 'blocks'
      and b.workspace_id = tasks.workspace_id and b.deleted_at is null
      and b.status_category in ${openCategoriesSql} and b.side = tasks.side
  )
)`;

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
  contextName,
  contextColor,
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
  subtaskOpen: subtaskCount(sql`s.status_category in ${openCategoriesSql}`),
  blocked,
};

// Ligne telle que la base la renvoie : side, statusCategory et contextColor en text.
type TaskRow = Omit<Task, "side" | "statusCategory" | "contextColor"> & {
  side: string;
  statusCategory: string;
  contextColor: string | null;
};

function toTask(row: TaskRow): Task {
  return {
    ...row,
    // CHECK tasks_side_check, tasks_status_category_check et contexts_color_check ; validés quand même.
    side: sideSchema.parse(row.side),
    statusCategory: statusCategorySchema.parse(row.statusCategory),
    contextColor:
      row.contextColor === null
        ? null
        : contextColorSchema.parse(row.contextColor),
    // time renvoyé en HH:MM:SS ; les secondes ne sont jamais saisies.
    dueTime: row.dueTime === null ? null : row.dueTime.slice(0, 5),
  };
}

// Échéance (sans échéance en dernier, heure avant « sans heure »), priorité (aucune en dernier), création.
// Repris par mutations.ts (moveTask) : ordre affiché des tâches sans clé d'une colonne du tableau.
export const listOrder = [
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
    f.topLevelOnly === true ? isNull(tasks.parentId) : undefined,
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

/**
 * Prochaines tâches ouvertes et actives d'un côté (tuiles « To-do privée » / « To-do pro »), espace en option,
 * dans l'ordre de la liste. Une sous-tâche sans échéance n'y est pas une ligne (même règle que la liste) : elle
 * est écartée ici, pour que `limit` lignes sortent même quand ces sous-tâches passeraient devant.
 */
export async function listUpcomingTasks(
  workspaceId: string,
  filter: UpcomingTasksFilter,
  tx: UserTx,
): Promise<Task[]> {
  const workspace = workspaceOf(workspaceId);
  const f = parseTaskInput(upcomingTasksFilterSchema, filter);
  const rows = await tx
    .select(taskColumns)
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspace),
        isActive,
        inArray(tasks.statusCategory, [...openStatusCategories]),
        eq(tasks.side, f.side),
        f.contextId === undefined
          ? undefined
          : eq(tasks.contextId, f.contextId),
        or(isNull(tasks.parentId), isNotNull(tasks.dueDate)),
      ),
    )
    .orderBy(...listOrder)
    .limit(f.limit);
  return rows.map(toTask);
}

// Total d'une colonne, porté par chaque ligne : compté avant la limite, dans la même requête que les cartes.
const columnTotal = sql<number>`(count(*) over ())::int`;

/** La ligne sans son total de colonne, qui ne sort pas dans la carte. */
function withoutTotal<T extends { total: number }>(row: T): Omit<T, "total"> {
  const copy: Omit<T, "total"> & { total?: number } = { ...row };
  delete copy.total;
  return copy;
}

/**
 * Tableau d'un côté : une colonne par catégorie, tâches actives seulement, sous-tâches en cartes (avec
 * `parentTitle`) sauf `includeSubtasks: false`. Une requête par colonne, total compris (fenêtre `count(*)
 * over ()`, calculée avant la limite) ; compteurs, tags et « bloquée » par sous-requêtes, comme `listTasks`.
 * - Colonnes ouvertes : clé d'ordre croissante (ordre octet de la colonne, COLLATE "C"), tâches sans clé
 *   ensuite dans l'ordre de la liste ; plafond de `TASK_LIST_MAX_LIMIT` cartes.
 * - Terminée, Annulée : clôture décroissante puis identifiant, `completedLimit` / `canceledLimit` cartes.
 * La clé d'ordre ne sort jamais : l'ordre est celui des tableaux rendus.
 */
export async function listBoard(
  workspaceId: string,
  filter: BoardFilter,
  tx: UserTx,
): Promise<Board> {
  const workspace = workspaceOf(workspaceId);
  const f = parseTaskInput(boardFilterSchema, filter);
  const limits: Record<StatusCategory, number> = {
    backlog: TASK_LIST_MAX_LIMIT,
    unstarted: TASK_LIST_MAX_LIMIT,
    started: TASK_LIST_MAX_LIMIT,
    completed: f.completedLimit,
    canceled: f.canceledLimit,
  };
  const columns: BoardColumn[] = [];
  for (const category of statusCategories) {
    const open = (openStatusCategories as readonly string[]).includes(category);
    const topLevelOnly =
      !f.includeSubtasks ||
      (f.hideCompletedSubtasks && category === "completed");
    const rows = await tx
      .select({ ...taskColumns, total: columnTotal })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspace),
          isActive,
          eq(tasks.statusCategory, category),
          eq(tasks.side, f.side),
          f.contextId === undefined
            ? undefined
            : eq(tasks.contextId, f.contextId),
          topLevelOnly ? isNull(tasks.parentId) : undefined,
        ),
      )
      .orderBy(
        ...(open
          ? [sql`${tasks.sortKey} asc nulls last`, ...listOrder]
          : [sql`${tasks.completedAt} desc nulls last`, asc(tasks.id)]),
      )
      .limit(limits[category]);
    const total = rows[0]?.total ?? 0;
    columns.push({
      category,
      tasks: rows.map((row) => toTask(withoutTotal(row))),
      total,
      truncated: total > rows.length,
    });
  }
  return { columns };
}

/**
 * Relations d'une tâche active (`side` : son côté), groupées. Une seule requête : la relation est lue par ses
 * deux bouts, l'autre tâche est jointe dans le même workspace, active et du même côté (une relation vers la
 * corbeille ou devenue transversale reste en base, masquée ici).
 */
async function listRelations(
  workspace: string,
  taskId: string,
  side: Side,
  tx: UserTx,
): Promise<TaskRelations> {
  const rows = await tx
    .select({
      kind: taskRelations.kind,
      outgoing: sql<boolean>`${taskRelations.fromTaskId} = ${taskId}`,
      id: tasks.id,
      title: tasks.title,
      statusCategory: tasks.statusCategory,
      contextName,
      contextColor,
    })
    .from(taskRelations)
    .innerJoin(
      tasks,
      and(
        eq(tasks.workspaceId, taskRelations.workspaceId),
        sql`${tasks.id} = case when ${taskRelations.fromTaskId} = ${taskId}
          then ${taskRelations.toTaskId} else ${taskRelations.fromTaskId} end`,
      ),
    )
    .where(
      and(
        eq(taskRelations.workspaceId, workspace),
        or(
          eq(taskRelations.fromTaskId, taskId),
          eq(taskRelations.toTaskId, taskId),
        ),
        eq(tasks.workspaceId, workspace),
        isActive,
        eq(tasks.side, side),
      ),
    )
    .orderBy(asc(tasks.title), asc(tasks.id));
  const relations: TaskRelations = { blocks: [], blockedBy: [], related: [] };
  for (const { kind, outgoing, ...row } of rows) {
    const group =
      kind === "related" ? "related" : outgoing ? "blocks" : "blockedBy";
    relations[group].push({
      ...row,
      statusCategory: statusCategorySchema.parse(row.statusCategory),
      contextColor:
        row.contextColor === null
          ? null
          : contextColorSchema.parse(row.contextColor),
    });
  }
  return relations;
}

/**
 * Une tâche active avec ses notes, ses tags, ses sous-tâches actives et ses relations ; null si absente ou à
 * la corbeille.
 */
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
  const { notes, ...rest } = row;
  const task = toTask(rest);
  return {
    ...task,
    notes,
    subtasks: subtasks.map(toTask),
    relations: await listRelations(workspace, task.id, task.side, tx),
  };
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
