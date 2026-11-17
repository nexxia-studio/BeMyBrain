import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Tables du socle (ADR-002, plan socle tâche 6). RLS activée dans la migration de chaque CREATE TABLE.
// Droits d'app_backend et fonctions d'appartenance : drizzle/0002 (migration SQL), policies : drizzle/0003.
// Trigger updated_at, droits par colonne sur contexts, droits par défaut des fonctions : drizzle/0005.
// Policies pour app_backend seul, une par verbe autorisé ; un verbe sans GRANT n'a pas de policy
// (refusé par absence de GRANT, voir 0002). Jamais FOR ALL ni USING (true).
// Pas de FORCE ROW LEVEL SECURITY : le propriétaire a BYPASSRLS sur Neon, qui l'emporte sur FORCE.

// Rôle créé dans Neon (tâche 4), pas par les migrations.
export const appBackend = pgRole("app_backend").existing();

const isMember = (workspaceId: AnyPgColumn) =>
  sql`app.is_workspace_member(${workspaceId})`;

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
};

// Le tenant lui-même : pas de workspace_id.
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [
    pgPolicy("workspaces_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.id),
    }),
  ],
).enableRLS();

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    // = neon_auth.user.id = sub du jeton = auth.uid()
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    locale: text("locale").notNull().default("fr"),
    ...timestamps,
  },
  (t) => [
    // Index unique (workspace_id, user_id) : sert aussi d'index à la FK workspace_id (colonne de tête).
    unique("workspace_members_workspace_user_unique").on(
      t.workspaceId,
      t.userId,
    ),
    index("workspace_members_user_id_idx").on(t.userId),
    check(
      "workspace_members_role_check",
      sql`${t.role} in ('owner', 'member')`,
    ),
    check("workspace_members_locale_check", sql`${t.locale} in ('fr', 'en')`),
    pgPolicy("workspace_members_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    // Sa propre ligne seulement ; GRANT UPDATE (locale) seul (0002) : role et workspace_id intouchables.
    // (select …) : évalué une fois par requête, pas par ligne.
    pgPolicy("workspace_members_update_own", {
      for: "update",
      to: appBackend,
      using: sql`${t.userId} = (select app.current_user_id())`,
      withCheck: sql`${t.userId} = (select app.current_user_id()) and ${isMember(t.workspaceId)}`,
    }),
  ],
).enableRLS();

export const contexts = pgTable(
  "contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    position: integer("position"),
    ...timestamps,
  },
  (t) => [
    // (workspace_id, kind) : listes par côté Privé / Pro, et index de la FK workspace_id (colonne de tête).
    index("contexts_workspace_id_kind_idx").on(t.workspaceId, t.kind),
    // Pas deux contextes de même nom dans un workspace (UI et upsert du seed, tâche 7).
    unique("contexts_workspace_name_unique").on(t.workspaceId, t.name),
    check("contexts_kind_check", sql`${t.kind} in ('private', 'pro')`),
    pgPolicy("contexts_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("contexts_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    // WITH CHECK : pas de déplacement vers un workspace dont on n'est pas membre.
    pgPolicy("contexts_update", {
      for: "update",
      to: appBackend,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("contexts_delete", {
      for: "delete",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
  ],
).enableRLS();
