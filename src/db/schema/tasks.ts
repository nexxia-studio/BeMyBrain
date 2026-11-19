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
// ni GRANT ni policy (corbeille = deleted_at). Toute FK vers une ligne métier est composite avec
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
    primaryKey({ name: "task_tags_pk", columns: [t.taskId, t.tagId] }),
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
    // Index de la FK tag et de la FK workspace_id (colonne de tête).
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
