import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import type { UserTx } from "@/db/client";
import { tags, tasks, taskTags } from "@/db/schema/tasks";
import { actionOrigins, type ActionOrigin } from "@/modules/actions/types";
import { sideSchema, uuidSchema } from "@/modules/core/schemas";
import type { Side } from "@/modules/core/sides";

import { TaskError } from "./errors";
import {
  findContextByName,
  getTask,
  isActive,
  listOrder,
  type TaskDetail,
} from "./queries";
import {
  createTaskInputSchema,
  moveTaskInputSchema,
  openStatusCategories,
  parseTaskInput,
  setTaskParentInputSchema,
  taskIdSchema,
  updateTaskInputSchema,
  type CreateTaskInput,
  type MoveTaskInput,
  type SetTaskParentInput,
  type StatusCategory,
  type UpdateTaskInput,
} from "./schemas";
import { keyBetween, keysFor } from "./sort-key";

// Écritures du module tasks (ADR-002). Même contrat que queries.ts : workspaceId en premier, transaction de
// withUserDb (RLS active) en dernier, filtre explicite sur workspaceId en plus de la RLS.
// Une écriture ne touche qu'une tâche active (sauf restoreTask) : une tâche à la corbeille est not_found.
// Sous-tâches : côté et espace suivent toujours la parente. Changer ceux de la parente se fait en UNE
// instruction sur la parente et toutes ses sous-tâches (corbeille comprise) : la FK parente
// (workspace_id, parent_id, side), NO ACTION, est vérifiée en fin d'instruction, sur l'état cohérent ; et un
// espace commun à toute la famille laisse passer le ON UPDATE CASCADE d'un changement de kind de l'espace.
// INSERT en SQL écrit : Drizzle liste toutes les colonnes de la table (DEFAULT pour les absentes), or
// app_backend n'a le droit INSERT que sur certaines (created_by, id, created_at… sont posés par la base).
// Ordre du tableau (sort_key) : une clé ne sort jamais du module (absente de Task et de TaskDetail).
// Ordre des verrous, le même dans toutes les écritures :
//   1. lockBoardOrder (ordre du tableau du workspace), dès que l'écriture peut poser ou vider une clé, ou
//      écrire plusieurs lignes de `tasks` : createTask dans une catégorie ouverte, updateTask avec
//      `statusCategory` (completeTask compris), `side` ou `context` (famille écrite en une instruction),
//      moveTask, moveTaskToTrash (famille), restoreTask (famille), setTaskParent (une ligne écrite, mais
//      selon l'état de la parente et des sous-tâches). Jamais pour un titre, des notes, des tags, une
//      échéance ou une priorité : une seule ligne écrite, aucune clé ;
//   2. la parente (lockTask) : celle de la tâche, ou celle qu'on lui donne (setTaskParent) ;
//   3. la tâche (lockTask), puis ses sous-tâches par l'instruction qui les écrit.
// Jamais lockBoardOrder après un verrou de ligne.
// Pourquoi les écritures de famille le prennent : la mise en ordre d'une colonne (moveTask) écrit toutes ses
// lignes après avoir verrouillé la carte déplacée. Hors du verrou d'ordre, une écriture de famille qui tient
// la parente et attend la sous-tâche déplacée s'interbloquerait avec elle (40P01). Sous le verrou, toutes
// les écritures de plusieurs lignes passent en série ; une écriture d'une seule ligne ne tient qu'un verrou
// de ligne et n'en attend aucun autre.
// moveTaskToTrash ne touche pas aux clés : celle d'une tâche à la corbeille reste, ignorée, puis remplacée à
// la restauration.
// Arrivée dans une colonne ouverte autrement que par un dépôt (création, changement de catégorie,
// réouverture, restauration) : en tête si la colonne a déjà des clés, sans clé sinon (arrivalKeys).

const originSchema = z.enum(actionOrigins);

const closedCategories = sql`('completed', 'canceled')`;

type LockedTask = {
  id: string;
  side: Side;
  contextId: string | null;
  parentId: string | null;
  dueDate: string | null;
  statusCategory: string;
  priority: number;
  /** Clé d'ordre : interne au module, jamais renvoyée. */
  sortKey: string | null;
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
      statusCategory: tasks.statusCategory,
      priority: tasks.priority,
      sortKey: tasks.sortKey,
      deleted: sql<boolean>`${tasks.deletedAt} is not null`,
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), eq(tasks.id, id)))
    .for("update");
  const row = rows[0];
  return row ? { ...row, side: sideSchema.parse(row.side) } : null;
}

/**
 * Colonnes d'un changement de catégorie (updateTask, moveTask). `completed_at` : posé au passage à completed
 * ou canceled (gardé entre les deux), vidé sinon. Dans un SET, les colonnes valent l'état d'avant l'instruction.
 */
function statusChange(statusCategory: StatusCategory) {
  return {
    statusCategory,
    completedAt: sql`case when ${statusCategory} in ${closedCategories}
      then case when ${tasks.statusCategory} in ${closedCategories} then ${tasks.completedAt} else now() end
    end`,
  };
}

/**
 * Sérialise les écritures d'ordre (sort_key) d'un workspace : verrou consultatif de transaction, relâché au
 * COMMIT ou au ROLLBACK, compatible avec le pooler (rien ne survit à la transaction).
 * Pourquoi un verrou consultatif plutôt que le verrouillage des lignes voisines : une clé se calcule dans un
 * intervalle, et verrouiller les lignes ne protège ni une colonne vide ni l'intervalle lui-même (deux
 * déplacements entre les mêmes voisines liraient les mêmes bornes et écriraient la même clé).
 * Pourquoi le workspace entier plutôt que (workspace, catégorie) : il couvre toutes les colonnes, donc
 * chaque colonne ; la première mise en ordre d'une colonne réécrit toutes ses lignes, y compris une carte
 * qu'un déplacement vers une AUTRE colonne tient verrouillée : deux verrous par colonne pris en sens croisés
 * s'interbloqueraient. Et un appelant qui ne connaît pas encore la catégorie (restauration) peut le prendre
 * en premier. Un déplacement dure quelques millisecondes : la file par workspace ne coûte rien.
 * Règle : le prendre avant tout verrou de ligne (lockTask), jamais après.
 * Une collision de hachage entre deux workspaces ne fait qu'une attente de plus, jamais une lecture croisée.
 */
async function lockBoardOrder(workspace: string, tx: UserTx): Promise<void> {
  const name = `tasks.sort_key:${workspace.toLowerCase()}`;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${name}, 0))`,
  );
}

function isOpenCategory(statusCategory: string): boolean {
  return (openStatusCategories as readonly string[]).includes(statusCategory);
}

/**
 * Tête d'une colonne : la plus petite clé des tâches actives de cette catégorie dans le workspace (hors
 * `exceptId`, la carte qu'on déplace), null si aucune n'a de clé. Seule lecture de la tête, pour un dépôt
 * (moveTask) comme pour une arrivée hors dépôt (arrivalKeys). À lire sous lockBoardOrder.
 */
async function columnHead(
  workspace: string,
  statusCategory: string,
  tx: UserTx,
  exceptId?: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ key: sql<string | null>`min(${tasks.sortKey})` })
    .from(tasks)
    .where(
      and(
        eq(tasks.workspaceId, workspace),
        eq(tasks.statusCategory, statusCategory),
        isActive,
        exceptId === undefined ? undefined : ne(tasks.id, exceptId),
      ),
    );
  return row?.key ?? null;
}

/**
 * Clés de `count` arrivées hors dépôt dans une colonne, dans l'ordre voulu (la première sera en tête) :
 * devant la tête si la colonne ouverte a déjà des clés, null sinon (colonne sans clé, Terminée, Annulée).
 * À appeler sous lockBoardOrder, avant que les arrivantes soient actives dans la colonne avec une clé.
 */
async function arrivalKeys(
  workspace: string,
  statusCategory: string,
  count: number,
  tx: UserTx,
): Promise<(string | null)[]> {
  let head = isOpenCategory(statusCategory)
    ? await columnHead(workspace, statusCategory, tx)
    : null;
  if (head === null) return Array.from({ length: count }, () => null);
  const keys: string[] = [];
  for (let index = 0; index < count; index++) {
    head = keyBetween(null, head);
    keys.unshift(head);
  }
  return keys;
}

/** Espace désigné par son nom (findContextByName) ; absent → context_not_found. */
async function resolveContext(
  workspace: string,
  name: string,
  side: Side | undefined,
  tx: UserTx,
): Promise<{ id: string; side: Side }> {
  const context = await findContextByName(workspace, name, side, tx);
  if (!context) throw new TaskError("context_not_found");
  return context;
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
 * Priorité absente : 0, ou celle de la parente pour une sous-tâche (copiée à la création, aucun suivi
 * ensuite) ; donnée, elle est respectée, 0 compris. Les tags de la parente ne sont jamais hérités.
 * Place dans le tableau : arrivée hors dépôt (arrivalKeys).
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

  const status = i.statusCategory ?? "unstarted";
  // Avant le verrou de la parente (ordre des verrous en tête du fichier).
  if (isOpenCategory(status)) await lockBoardOrder(workspace, tx);

  let side: Side;
  let contextId: string | null = null;
  let priority = i.priority ?? 0;
  if (i.parentId !== undefined) {
    if (i.side !== undefined || i.context !== undefined) {
      throw new TaskError("subtask_follows_parent");
    }
    // Verrou : la parente ne change ni de côté, ni d'espace, ni de priorité avant l'insertion.
    const parent = await lockTask(workspace, i.parentId, tx);
    if (!parent) throw new TaskError("not_found");
    if (parent.deleted) throw new TaskError("parent_in_trash");
    if (parent.parentId !== null) throw new TaskError("subtask_depth");
    side = parent.side;
    contextId = parent.contextId;
    priority = i.priority ?? parent.priority;
  } else if (i.context !== undefined) {
    const context = await resolveContext(workspace, i.context, i.side, tx);
    side = context.side;
    contextId = context.id;
  } else if (i.side !== undefined) {
    side = i.side;
  } else {
    throw new TaskError("invalid_params");
  }

  const [sortKey] = await arrivalKeys(workspace, status, 1, tx);
  const result = await tx.execute<{ id: string }>(sql`
    insert into ${tasks} (workspace_id, side, context_id, parent_id, title, notes, status_category, priority,
      due_date, due_time, completed_at, origin, sort_key)
    values (${workspace}, ${side}, ${contextId}, ${i.parentId ?? null}, ${i.title}, ${i.notes ?? null},
      ${status}, ${priority}, ${i.dueDate ?? null}, ${i.dueTime ?? null},
      case when ${status} in ${closedCategories} then now() end, ${taskOrigin}, ${sortKey ?? null})
    returning id`);
  const id = result.rows[0].id;
  if (i.tags !== undefined) await addTags(workspace, id, i.tags, tx);
  return reload(workspace, id, tx);
}

/**
 * Modifie une tâche active et renvoie son détail. Tags par `addTags` / `removeTags`, jamais de remplacement.
 * Côté et espace (refusés sur une sous-tâche) : un espace donne son côté ; un côté seul qui change retire
 * l'espace (un espace n'a qu'un côté). La parente et ses sous-tâches changent ensemble.
 * `completed_at` : posé au passage à completed ou canceled (gardé entre les deux), vidé sinon (statusChange).
 * Place dans le tableau : catégorie inchangée ou absente → clé inchangée ; autre catégorie → arrivée hors
 * dépôt (arrivalKeys : tête d'une colonne ouverte ordonnée, sans clé sinon, Terminée et Annulée comprises).
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

  // Catégorie (clé) ou côté et espace (famille écrite en une instruction) : verrou d'ordre avant le verrou
  // de ligne (voir en tête du fichier).
  if (
    fields.statusCategory !== undefined ||
    side !== undefined ||
    context !== undefined
  ) {
    await lockBoardOrder(workspace, tx);
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
  const arrival =
    statusCategory !== undefined && statusCategory !== task.statusCategory
      ? await arrivalKeys(workspace, statusCategory, 1, tx)
      : [];
  const set = {
    ...rest,
    // Date retirée → heure retirée (CHECK tasks_due_time_check).
    dueTime: fields.dueDate === null && dueTime === undefined ? null : dueTime,
    ...(statusCategory === undefined ? {} : statusChange(statusCategory)),
    ...(arrival.length === 0 ? {} : { sortKey: arrival[0] }),
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

/**
 * Déplace une tâche ou une sous-tâche active dans le tableau : catégorie d'arrivée et place, puis son détail.
 * La parente d'une sous-tâche n'est jamais touchée. Changement de catégorie : `completed_at` comme updateTask.
 * - Terminée, Annulée : pas d'ordre manuel, la position est ignorée et la clé vidée.
 * - Colonne ouverte : si une autre tâche active de la catégorie n'a pas de clé, toutes en reçoivent une
 *   d'abord, dans l'ordre affiché (clés croissantes, puis ordre de la liste), sous-tâches, côtés et espaces
 *   confondus. Puis la carte va juste après `beforeId` ; à défaut juste avant `afterId` ; à défaut en tête.
 *   Une voisine absente, à la corbeille, d'un autre workspace ou d'une autre catégorie est ignorée (tableau
 *   affiché périmé), sans erreur et sans rien en dire. L'autre borne est toujours la clé réellement voisine
 *   en base, jamais celle de l'identifiant reçu.
 * - Déjà à la place demandée : rien n'est écrit.
 * - Déjà dans la colonne fermée visée, sans clé : rien n'est écrit.
 * Voisines : relues sous le verrou d'ordre du workspace (lockBoardOrder), sans verrou de ligne. Ce verrou fige
 * leurs clés, leur catégorie et leur présence : toute écriture de clé, de catégorie, de corbeille ou de
 * famille le prend (voir en tête du fichier). Reste hors verrou l'écriture d'un ancien déploiement, lue à son
 * état validé.
 */
export async function moveTask(
  workspaceId: string,
  input: MoveTaskInput,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const i = parseTaskInput(moveTaskInputSchema, input);
  // Postgres rend les uuid en minuscules : mêmes identifiants pour les comparaisons faites ici.
  const taskId = i.taskId.toLowerCase();
  const beforeId = i.beforeId?.toLowerCase();
  const afterId = i.afterId?.toLowerCase();
  const target = i.statusCategory;

  await lockBoardOrder(workspace, tx);
  const task = await lockTask(workspace, taskId, tx);
  if (!task || task.deleted) throw new TaskError("not_found");

  const write = (sortKey: string | null) =>
    tx
      .update(tasks)
      .set({ ...statusChange(target), sortKey })
      .where(
        and(eq(tasks.workspaceId, workspace), eq(tasks.id, taskId), isActive),
      );

  if (!isOpenCategory(target)) {
    if (task.statusCategory !== target || task.sortKey !== null) {
      await write(null);
    }
    return reload(workspace, taskId, tx);
  }

  // Les autres tâches actives de la colonne d'arrivée, dans ce workspace.
  const column = and(
    eq(tasks.workspaceId, workspace),
    eq(tasks.statusCategory, target),
    isActive,
    ne(tasks.id, taskId),
  );

  const keyless = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(column, isNull(tasks.sortKey)))
    .limit(1);
  const reordered = keyless.length > 0;
  if (reordered) {
    const rows = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(column)
      .orderBy(sql`${tasks.sortKey} asc nulls last`, ...listOrder);
    // Au-delà de KEYS_FOR_MAX, keysFor lève (phrase fixe) : rien n'est écrit.
    const keys = keysFor(rows.length);
    // Deux paramètres quel que soit le nombre de lignes : uuid et clés ne contiennent jamais de virgule.
    const ids = rows.map((row) => row.id).join(",");
    await tx.execute(sql`
      update ${tasks} set sort_key = v.key
      from unnest(string_to_array(${ids}, ',')::uuid[], string_to_array(${keys.join(",")}, ',')) as v(id, key)
      where tasks.workspace_id = ${workspace} and tasks.id = v.id and tasks.deleted_at is null
        and tasks.status_category = ${target}`);
  }

  const wanted = [beforeId, afterId].filter((id) => id !== undefined);
  // Voisine sans clé : écrite hors verrou d'ordre par un ancien déploiement ; ignorée comme une périmée.
  const neighbours =
    wanted.length === 0
      ? []
      : await tx
          .select({ id: tasks.id, sortKey: tasks.sortKey })
          .from(tasks)
          .where(
            and(column, inArray(tasks.id, wanted), isNotNull(tasks.sortKey)),
          );
  const keyOf = (id: string | undefined) =>
    neighbours.find((row) => row.id === id)?.sortKey ?? null;
  /** Plus petite (`min`) ou plus grande (`max`) clé de la colonne, sous condition. */
  const edge = async (fn: "min" | "max", condition?: SQL) => {
    const [row] = await tx
      .select({
        key: sql<string | null>`${sql.raw(fn)}(${tasks.sortKey})`,
      })
      .from(tasks)
      .where(and(column, condition));
    return row?.key ?? null;
  };

  // Bornes de la place : (clé de beforeId, clé suivante) ; sinon (clé précédente, clé d'afterId) ; sinon tête.
  let low = keyOf(beforeId);
  let high = low === null ? keyOf(afterId) : null;
  if (low !== null) {
    high = await edge("min", gt(tasks.sortKey, low));
  } else if (high !== null) {
    low = await edge("max", lt(tasks.sortKey, high));
  } else {
    high = await columnHead(workspace, target, tx, taskId);
  }

  // Comparaison JS = ordre de la colonne (COLLATE "C") : l'alphabet des clés est en ASCII croissant.
  const current =
    reordered || task.statusCategory !== target ? null : task.sortKey;
  const inPlace =
    current !== null &&
    (low === null || low < current) &&
    (high === null || current < high);
  if (!inPlace) await write(keyBetween(low, high));
  return reload(workspace, taskId, tx);
}

/**
 * Rattache une tâche active à une parente, la change de parente, ou la détache (`parentId: null`) ; renvoie
 * son détail. Une seule ligne écrite, en une instruction, y compris pour un changement de parente (aucun
 * détachement intermédiaire) : `parent_id` et `context_id` (espace de la parente). Côté, statut, place
 * (`sort_key`), priorité, tags et relations ne changent pas ; détachée, la tâche garde aussi son espace.
 * Refus, dans cet ordre : tâche absente, d'un autre workspace ou à la corbeille → not_found ; elle-même →
 * invalid_params ; parente absente ou d'un autre workspace → not_found (même réponse, aucun oracle) ; à la
 * corbeille → parent_in_trash ; elle-même sous-tâche → subtask_depth ; de l'autre côté → cross_side_parent
 * (avant toute écriture : la clé étrangère (workspace_id, parent_id, side) n'est qu'un second verrou) ; la
 * tâche a une sous-tâche active → has_subtasks (des sous-tâches à la corbeille ne comptent pas : elles ne se
 * restaurent plus tant que la tâche est sous-tâche, voir restoreTask).
 * Déjà dans l'état demandé (même parente, ou déjà de premier niveau) : rien n'est écrit.
 *
 * Verrous : lockBoardOrder, puis la parente visée, puis la tâche (ordre de l'en-tête).
 * Pourquoi ni cycle ni profondeur 2, même avec deux appels croisés (A sous B pendant que B passe sous A) :
 * - le verrou d'ordre met en série tous les setTaskParent du workspace, et avec eux toute écriture qui
 *   change ce que les règles lisent : corbeille et restauration (deleted_at), côté et espace d'une famille
 *   (updateTask). Aucune autre écriture ne modifie parent_id, deleted_at ni side ;
 * - le second appel ne lit qu'après avoir obtenu ce verrou, donc après le COMMIT du premier (READ
 *   COMMITTED : chaque instruction voit ce qui est validé). Il lit A déjà sous B : « B sous A » vise une
 *   parente qui est sous-tâche → subtask_depth. De même, « T sous P » et « P sous Q » en parallèle : le
 *   second lit soit P déjà sous-tâche (subtask_depth), soit P déjà parente de T (has_subtasks) ;
 * - seule écriture de la famille hors verrou d'ordre : createTask d'une sous-tâche née terminée ou annulée.
 *   Elle verrouille sa parente (lockTask) avant d'insérer, et setTaskParent verrouille les deux lignes dont
 *   il juge l'état : l'un attend l'autre sur la ligne, puis la relit (FOR UPDATE rend la version validée).
 *   Sous-tâche créée sous T d'abord → has_subtasks ; T rattachée d'abord → la création lit T sous-tâche →
 *   subtask_depth.
 * Pas d'interblocage : entre porteurs du verrou d'ordre, les verrous de ligne ne se croisent jamais (série) ;
 * hors verrou d'ordre, une écriture ne tient qu'une ligne et n'en attend aucune autre.
 */
export async function setTaskParent(
  workspaceId: string,
  input: SetTaskParentInput,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const i = parseTaskInput(setTaskParentInputSchema, input);
  // Postgres rend les uuid en minuscules : mêmes identifiants pour les comparaisons faites ici.
  const taskId = i.taskId.toLowerCase();
  const parentId = i.parentId?.toLowerCase() ?? null;
  const self = parentId === taskId;

  await lockBoardOrder(workspace, tx);
  const parent =
    parentId === null || self ? null : await lockTask(workspace, parentId, tx);
  const task = await lockTask(workspace, taskId, tx);
  if (!task || task.deleted) throw new TaskError("not_found");
  if (self) throw new TaskError("invalid_params");

  let set: { parentId: string | null; contextId?: string | null } | null;
  if (parentId === null) {
    set = task.parentId === null ? null : { parentId: null };
  } else {
    if (!parent) throw new TaskError("not_found");
    if (parent.deleted) throw new TaskError("parent_in_trash");
    if (parent.parentId !== null) throw new TaskError("subtask_depth");
    if (parent.side !== task.side) throw new TaskError("cross_side_parent");
    const subtasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, workspace),
          eq(tasks.parentId, taskId),
          isActive,
        ),
      )
      .limit(1);
    if (subtasks.length > 0) throw new TaskError("has_subtasks");
    set =
      task.parentId === parent.id
        ? null
        : { parentId: parent.id, contextId: parent.contextId };
  }
  if (set !== null) {
    await tx
      .update(tasks)
      .set(set)
      .where(
        and(eq(tasks.workspaceId, workspace), eq(tasks.id, taskId), isActive),
      );
  }
  return reload(workspace, taskId, tx);
}

export type TrashResult = {
  id: string;
  /** Sous-tâches actives mises à la corbeille avec elle (même horodatage). */
  subtaskCount: number;
};

/**
 * Met une tâche active à la corbeille (deleted_at, aucun DELETE). Parente : ses sous-tâches encore actives
 * reçoivent le même horodatage, en une instruction (statement_timestamp() : même valeur pour toutes les
 * lignes d'une instruction, distincte d'une instruction à l'autre, même dans une transaction, là où now()
 * confondrait une sous-tâche jetée seule plus tôt avec ses sœurs) ; une sous-tâche déjà à la corbeille
 * garde le sien. Absente, d'un autre workspace ou déjà à
 * la corbeille → not_found.
 */
export async function moveTaskToTrash(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TrashResult> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const id = parseTaskInput(taskIdSchema, taskId);

  // Famille écrite en une instruction : verrou d'ordre d'abord (voir en tête du fichier).
  await lockBoardOrder(workspace, tx);
  // Verrou sur la tâche : même ordre que createTask (parente d'abord), aucune sous-tâche créée entre-temps.
  const task = await lockTask(workspace, id, tx);
  if (!task || task.deleted) throw new TaskError("not_found");

  const result = await tx.execute<{ id: string }>(sql`
    update ${tasks} set deleted_at = statement_timestamp()
    where workspace_id = ${workspace} and deleted_at is null and (id = ${id} or parent_id = ${id})
    returning id`);
  return { id, subtaskCount: result.rows.length - 1 };
}

/**
 * Restaure une tâche de la corbeille et renvoie son détail. Parente : seulement les sous-tâches qui portent
 * son horodatage (mises à la corbeille avec elle). Sous-tâche dont la parente est à la corbeille →
 * parent_in_trash ; dont la parente est entre-temps devenue sous-tâche → subtask_depth (un seul niveau ; elle
 * se restaure après détachement de sa parente). Tâche active : rien à faire, détail renvoyé. Absente ou d'un
 * autre workspace → not_found.
 * Place dans le tableau : la clé d'avant la corbeille n'est jamais reprise (elle peut être devenue celle d'une
 * autre tâche). Chaque tâche restaurée est une arrivée hors dépôt dans sa colonne (arrivalKeys), la tâche
 * demandée devant ses sous-tâches quand elles partagent une colonne : jamais deux clés égales.
 */
export async function restoreTask(
  workspaceId: string,
  taskId: string,
  tx: UserTx,
): Promise<TaskDetail> {
  const workspace = parseTaskInput(uuidSchema, workspaceId);
  const id = parseTaskInput(taskIdSchema, taskId);

  // La catégorie et l'état (corbeille ou non) ne sont pas encore connus : verrou d'ordre pris d'office, avant
  // tout verrou de ligne.
  await lockBoardOrder(workspace, tx);
  // parent_id est lu sans verrou, pour verrouiller la parente avant la sous-tâche, dans l'ordre de
  // moveTaskToTrash (pas d'interblocage avec une mise à la corbeille). Il peut changer (setTaskParent) :
  // sous le verrou d'ordre, plus entre cette lecture et le verrou de la tâche ; hors de lui (écriture d'un
  // autre chemin), si. La parente qui compte est donc celle relue sur la ligne verrouillée.
  const [found] = await tx
    .select({ parentId: tasks.parentId })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspace), eq(tasks.id, id)));
  if (!found) throw new TaskError("not_found");
  let parent =
    found.parentId === null
      ? null
      : await lockTask(workspace, found.parentId, tx);
  const task = await lockTask(workspace, id, tx);
  if (!task) throw new TaskError("not_found");
  if (task.parentId !== found.parentId) {
    parent =
      task.parentId === null
        ? null
        : await lockTask(workspace, task.parentId, tx);
  }
  if (task.parentId !== null) {
    if (!parent || parent.deleted) throw new TaskError("parent_in_trash");
    // Parente devenue sous-tâche pendant que celle-ci était à la corbeille : un seul niveau.
    if (parent.parentId !== null) throw new TaskError("subtask_depth");
  }

  if (task.deleted) {
    // Horodatage comparé en base (microsecondes), pas via un Date JS (millisecondes). La sous-requête voit
    // l'état d'avant l'instruction, et le verrou posé juste avant par lockTask rend la valeur stable.
    // Clé vidée dans la même instruction : aucune restaurée ne compte dans la tête de sa colonne avant
    // d'y être placée.
    const restored = await tx.execute<{
      id: string;
      status_category: string;
    }>(sql`
      update ${tasks} set deleted_at = null, sort_key = null
      where workspace_id = ${workspace} and (id = ${id} or (parent_id = ${id} and deleted_at = (
        select deleted_at from ${tasks} where workspace_id = ${workspace} and id = ${id}
      )))
      returning id, status_category`);
    // La tâche demandée d'abord, puis ses sous-tâches par identifiant (ordre stable).
    const arrivals = restored.rows
      .map((row) => ({ ...row, id: row.id.toLowerCase() }))
      .sort(
        (a, b) =>
          Number(b.id === task.id) - Number(a.id === task.id) ||
          (a.id < b.id ? -1 : 1),
      );
    const placed: { id: string; key: string }[] = [];
    for (const statusCategory of openStatusCategories) {
      const rows = arrivals.filter(
        (row) => row.status_category === statusCategory,
      );
      if (rows.length === 0) continue;
      const keys = await arrivalKeys(
        workspace,
        statusCategory,
        rows.length,
        tx,
      );
      for (const [index, row] of rows.entries()) {
        const key = keys[index];
        if (typeof key === "string") placed.push({ id: row.id, key });
      }
    }
    if (placed.length > 0) {
      // Même forme que la mise en ordre de moveTask : deux paramètres quel que soit le nombre de lignes.
      await tx.execute(sql`
        update ${tasks} set sort_key = v.key
        from unnest(string_to_array(${placed.map((row) => row.id).join(",")}, ',')::uuid[],
          string_to_array(${placed.map((row) => row.key).join(",")}, ',')) as v(id, key)
        where tasks.workspace_id = ${workspace} and tasks.id = v.id and tasks.deleted_at is null`);
    }
  }
  return reload(workspace, id, tx);
}
