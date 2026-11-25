import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { appBackend, contexts, workspaces } from "./core";

// To-do unifiée, tranche 1 (spec docs/features/todo-unifiee/spec.md, migration drizzle/0006_tasks.sql).
// Complété à la main dans 0006 (Drizzle ne l'exprime pas) : ON DELETE SET NULL (context_id) de la FK
// vers contexts, triggers updated_at, GRANT par colonne d'app_backend. Pas de DELETE sur tasks ni tags :
// ni GRANT ni policy (corbeille = deleted_at). Complété à la main dans 0008 : COLLATE "C" de sort_key,
// GRANT INSERT (sort_key) et UPDATE (sort_key, parent_id). Toute FK vers une ligne métier est composite avec
// workspace_id : la base refuse un lien entre workspaces, quelle que soit la RLS.

const isMember = (workspaceId: AnyPgColumn) =>
  sql`app.is_workspace_member(${workspaceId})`;

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    side: text("side").notNull(),
    contextId: uuid("context_id"),
    parentId: uuid("parent_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    statusCategory: text("status_category").notNull().default("unstarted"),
    priority: smallint("priority").notNull().default(0),
    dueDate: date("due_date"),
    dueTime: time("due_time"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Posée par le point d'entrée serveur de l'action, jamais modifiable (pas de GRANT UPDATE).
    origin: text("origin").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Clé d'ordre fractionnaire du tableau, par workspace et par catégorie. COLLATE "C" en base (0008,
    // Drizzle ne l'exprime pas) : comparée octet par octet. NULL = tâche jamais placée à la main.
    sortKey: text("sort_key"),
    // Posé par la base, hors GRANT de l'app.
    createdBy: uuid("created_by")
      .notNull()
      .default(sql`app.current_user_id()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    // Cibles des FK composites (task_tags ; sous-tâches). La première sert aussi d'index à la FK workspace_id.
    unique("tasks_workspace_id_id_unique").on(t.workspaceId, t.id),
    unique("tasks_workspace_id_id_side_unique").on(t.workspaceId, t.id, t.side),
    // Espace du même workspace et du même côté. Le côté suit le kind de l'espace (ON UPDATE CASCADE).
    // onDelete réel : SET NULL (context_id) seul, réécrit dans 0006 (un SET NULL de toutes les colonnes
    // viderait workspace_id et side, NOT NULL).
    foreignKey({
      name: "tasks_context_fk",
      columns: [t.workspaceId, t.contextId, t.side],
      foreignColumns: [contexts.workspaceId, contexts.id, contexts.kind],
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    // Sous-tâche : même workspace et même côté que sa parente (NO ACTION, vérifiée en fin d'instruction).
    foreignKey({
      name: "tasks_parent_fk",
      columns: [t.workspaceId, t.parentId, t.side],
      foreignColumns: [t.workspaceId, t.id, t.side],
    }),
    index("tasks_workspace_side_status_idx")
      .on(t.workspaceId, t.side, t.statusCategory)
      .where(sql`deleted_at is null`),
    index("tasks_workspace_due_date_idx")
      .on(t.workspaceId, t.dueDate)
      .where(sql`deleted_at is null`),
    index("tasks_workspace_context_idx")
      .on(t.workspaceId, t.contextId)
      .where(sql`deleted_at is null`),
    index("tasks_workspace_parent_idx")
      .on(t.workspaceId, t.parentId)
      .where(sql`deleted_at is null`),
    index("tasks_workspace_status_sort_key_idx")
      .on(t.workspaceId, t.statusCategory, t.sortKey)
      .where(sql`deleted_at is null`),
    index("tasks_workspace_trash_idx")
      .on(t.workspaceId, t.deletedAt)
      .where(sql`deleted_at is not null`),
    check("tasks_side_check", sql`${t.side} in ('private', 'pro')`),
    check(
      "tasks_title_check",
      sql`char_length(btrim(${t.title})) between 1 and 500`,
    ),
    check("tasks_notes_check", sql`char_length(${t.notes}) <= 10000`),
    check(
      "tasks_status_category_check",
      sql`${t.statusCategory} in ('backlog', 'unstarted', 'started', 'completed', 'canceled')`,
    ),
    check("tasks_priority_check", sql`${t.priority} between 0 and 4`),
    check(
      "tasks_due_time_check",
      sql`${t.dueTime} is null or ${t.dueDate} is not null`,
    ),
    check(
      "tasks_origin_check",
      sql`${t.origin} in ('app', 'palette', 'assistant', 'whatsapp', 'slack')`,
    ),
    // 0010 (BRAIN-60), seconds verrous des règles tenues par les mutations. NULL reste permis dans les deux.
    check("tasks_parent_not_self_check", sql`${t.parentId} <> ${t.id}`),
    // Forme d'une clé : alphabet du module, jamais vide, 64 caractères au plus (SORT_KEY_MAX_LENGTH de
    // src/modules/tasks/sort-key.ts, un test compare les deux), jamais terminée par « 0 ».
    check(
      "tasks_sort_key_check",
      sql`${t.sortKey} ~ '^[0-9A-Za-z]+$' and char_length(${t.sortKey}) <= 64 and right(${t.sortKey}, 1) <> '0'`,
    ),
    pgPolicy("tasks_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("tasks_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("tasks_update", {
      for: "update",
      to: appBackend,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
  ],
).enableRLS();

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    // Cible de la FK composite de task_tags ; index de la FK workspace_id.
    unique("tags_workspace_id_id_unique").on(t.workspaceId, t.id),
    uniqueIndex("tags_workspace_lower_name_unique").on(
      t.workspaceId,
      sql`lower(${t.name})`,
    ),
    check(
      "tags_name_check",
      sql`char_length(btrim(${t.name})) between 1 and 50`,
    ),
    pgPolicy("tags_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("tags_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("tags_update", {
      for: "update",
      to: appBackend,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
  ],
).enableRLS();

export const taskTags = pgTable(
  "task_tags",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    taskId: uuid("task_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // workspace_id dans la clé : une insertion d'un autre workspace ne heurte jamais un lien existant,
    // seule la FK composite répond (pas d'oracle d'existence entre workspaces). Sert aussi d'index à la
    // FK tâche (workspace_id, task_id) et à la FK workspace_id.
    primaryKey({
      name: "task_tags_pk",
      columns: [t.workspaceId, t.taskId, t.tagId],
    }),
    foreignKey({
      name: "task_tags_task_fk",
      columns: [t.workspaceId, t.taskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }),
    foreignKey({
      name: "task_tags_tag_fk",
      columns: [t.workspaceId, t.tagId],
      foreignColumns: [tags.workspaceId, tags.id],
    }),
    // Index de la FK tag (workspace_id, tag_id), que la clé primaire ne couvre pas.
    index("task_tags_workspace_tag_idx").on(t.workspaceId, t.tagId),
    pgPolicy("task_tags_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("task_tags_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    // Retirer un tag d'une tâche. Pas d'UPDATE : un lien se retire et se recrée.
    pgPolicy("task_tags_delete", {
      for: "delete",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
  ],
).enableRLS();

// Relations entre tâches (spec docs/features/todo-kanban/spec.md, migration drizzle/0009). Complété à la
// main dans 0009 : trigger updated_at, GRANT d'app_backend (SELECT, DELETE, INSERT sur workspace_id,
// from_task_id, to_task_id, kind ; aucun UPDATE). Pas de colonne de côté : la règle « même côté » est
// tenue par les mutations (durcissement en base : BRAIN-59).
export const taskRelations = pgTable(
  "task_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    // blocks : de la bloquante (from) vers la bloquée (to). related : symétrique, rangée une seule fois.
    fromTaskId: uuid("from_task_id").notNull(),
    toTaskId: uuid("to_task_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [
    // workspace_id dans la clé : une insertion d'un autre workspace ne heurte jamais une relation
    // existante, seule la FK composite répond (pas d'oracle d'existence entre workspaces). Sert aussi
    // d'index à la FK de départ (workspace_id, from_task_id) et à la FK workspace_id.
    unique("task_relations_workspace_from_to_kind_unique").on(
      t.workspaceId,
      t.fromTaskId,
      t.toTaskId,
      t.kind,
    ),
    // Les deux tâches sont du workspace de la relation : la base refuse une relation entre workspaces,
    // quelle que soit la RLS.
    foreignKey({
      name: "task_relations_from_task_fk",
      columns: [t.workspaceId, t.fromTaskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }),
    foreignKey({
      name: "task_relations_to_task_fk",
      columns: [t.workspaceId, t.toTaskId],
      foreignColumns: [tasks.workspaceId, tasks.id],
    }),
    // Index de la FK d'arrivée, et lecture inverse (« Bloquée par », « bloquée »).
    index("task_relations_workspace_to_task_idx").on(t.workspaceId, t.toTaskId),
    check("task_relations_kind_check", sql`${t.kind} in ('blocks', 'related')`),
    check(
      "task_relations_not_self_check",
      sql`${t.fromTaskId} <> ${t.toTaskId}`,
    ),
    // « Liée à » est symétrique : plus petit identifiant en premier, donc une seule ligne par paire.
    check(
      "task_relations_related_order_check",
      sql`${t.kind} <> 'related' or ${t.fromTaskId} < ${t.toTaskId}`,
    ),
    pgPolicy("task_relations_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("task_relations_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    // Retirer une relation. Pas d'UPDATE : une relation s'ajoute ou se retire.
    pgPolicy("task_relations_delete", {
      for: "delete",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
  ],
).enableRLS();
