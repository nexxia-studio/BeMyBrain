import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Relatif et non « @/ » : drizzle-kit charge ce fichier sans les alias du projet. aisles.ts n'a aucune dépendance.
import { AISLE_KEYS } from "../../modules/shopping/aisles";
import { appBackend, workspaces } from "./core";

// Listes de courses (spec docs/features/listes/spec.md, migration drizzle/0011). Complété à la main dans
// 0011 (Drizzle ne l'exprime pas) : triggers updated_at, GRANT par colonne d'app_backend. Pas de DELETE
// sur shopping_lists (une liste par workspace, jamais supprimée), pas de DELETE sur les corrections ni
// l'ordre (ni GRANT ni policy). Toute FK vers une ligne métier est composite avec workspace_id.
// Aucune policy pour un invité : le partage (PR B) passe par des fonctions SECURITY DEFINER.

const isMember = (workspaceId: AnyPgColumn) =>
  sql`app.is_workspace_member(${workspaceId})`;

// Table à données par utilisateur : membre du workspace ET ligne de l'utilisateur connecté.
const isMemberAndSelf = (workspaceId: AnyPgColumn, userId: AnyPgColumn) =>
  sql`app.is_workspace_member(${workspaceId}) and ${userId} = app.current_user_id()`;

// Même liste que AISLE_KEYS, une seule source : un test compare le CHECK du catalogue à ce tuple.
const aisleList = sql.raw(AISLE_KEYS.map((key) => `'${key}'`).join(", "));

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
};

// Une liste « Courses » par workspace, créée au premier accès.
export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    // Compteur de version, incrémenté par chaque écriture (synchro temps réel, PR B).
    rev: bigint("rev", { mode: "number" }).notNull().default(0),
    // Canal temps réel : uuid aléatoire, distinct de l'id, jamais posé par l'app.
    channelId: uuid("channel_id").notNull().defaultRandom(),
    ...timestamps,
  },
  (t) => [
    // Une liste par workspace ; sert aussi d'index à la FK workspace_id.
    unique("shopping_lists_workspace_id_unique").on(t.workspaceId),
    // Cible des FK composites (shopping_items).
    unique("shopping_lists_workspace_id_id_unique").on(t.workspaceId, t.id),
    check(
      "shopping_lists_name_check",
      sql`char_length(btrim(${t.name})) between 1 and 80`,
    ),
    // Jamais négatif ; ne bouge que de 0 ou +1 (trigger shopping_lists_guard_rev, migration 0011).
    check("shopping_lists_rev_check", sql`${t.rev} >= 0`),
    pgPolicy("shopping_lists_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("shopping_lists_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("shopping_lists_update", {
      for: "update",
      to: appBackend,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
  ],
).enableRLS();

export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    listId: uuid("list_id").notNull(),
    // Libellé tel que saisi (la normalisation sert au classement seulement).
    label: text("label").notNull(),
    // Posé par classifyAisle, ou à la main (aisle_pinned).
    aisleKey: text("aisle_key").notNull(),
    // Rayon choisi à la main : un renommage ne le reclasse plus.
    aislePinned: boolean("aisle_pinned").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    // Posé par les fonctions d'invité (PR B), jamais par app_backend (hors GRANT).
    addedByGuest: boolean("added_by_guest").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    // Liste du même workspace : la base refuse un article sur la liste d'un autre workspace.
    foreignKey({
      name: "shopping_items_list_fk",
      columns: [t.workspaceId, t.listId],
      foreignColumns: [shoppingLists.workspaceId, shoppingLists.id],
    }),
    // Lecture de la liste ; sert aussi d'index à la FK composite et à la FK workspace_id.
    index("shopping_items_workspace_list_idx").on(t.workspaceId, t.listId),
    check(
      "shopping_items_label_check",
      sql`char_length(btrim(${t.label})) between 1 and 80`,
    ),
    check(
      "shopping_items_aisle_key_check",
      sql`${t.aisleKey} in (${aisleList})`,
    ),
    pgPolicy("shopping_items_select", {
      for: "select",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
    pgPolicy("shopping_items_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("shopping_items_update", {
      for: "update",
      to: appBackend,
      using: isMember(t.workspaceId),
      withCheck: isMember(t.workspaceId),
    }),
    pgPolicy("shopping_items_delete", {
      for: "delete",
      to: appBackend,
      using: isMember(t.workspaceId),
    }),
  ],
).enableRLS();

// Corrections de rayon mémorisées, par (workspace, utilisateur) : keyword = libellé normalisé complet.
export const shoppingAisleOverrides = pgTable(
  "shopping_aisle_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    // Posé par la base (utilisateur connecté), hors GRANT de l'app : personne n'écrit pour un autre.
    userId: uuid("user_id")
      .notNull()
      .default(sql`app.current_user_id()`),
    keyword: text("keyword").notNull(),
    aisleKey: text("aisle_key").notNull(),
    ...timestamps,
  },
  (t) => [
    // Sert aussi d'index à la FK workspace_id et de cible à l'upsert de la correction.
    unique("shopping_aisle_overrides_workspace_user_keyword_unique").on(
      t.workspaceId,
      t.userId,
      t.keyword,
    ),
    check(
      "shopping_aisle_overrides_keyword_check",
      sql`char_length(btrim(${t.keyword})) between 1 and 80`,
    ),
    check(
      "shopping_aisle_overrides_aisle_key_check",
      sql`${t.aisleKey} in (${aisleList})`,
    ),
    pgPolicy("shopping_aisle_overrides_select", {
      for: "select",
      to: appBackend,
      using: isMemberAndSelf(t.workspaceId, t.userId),
    }),
    pgPolicy("shopping_aisle_overrides_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMemberAndSelf(t.workspaceId, t.userId),
    }),
    pgPolicy("shopping_aisle_overrides_update", {
      for: "update",
      to: appBackend,
      using: isMemberAndSelf(t.workspaceId, t.userId),
      withCheck: isMemberAndSelf(t.workspaceId, t.userId),
    }),
  ],
).enableRLS();

// Ordre des rayons choisi par un utilisateur : clés dans l'ordre affiché.
export const shoppingAisleOrder = pgTable(
  "shopping_aisle_order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: uuid("user_id")
      .notNull()
      .default(sql`app.current_user_id()`),
    aisleKeys: text("aisle_keys").array().notNull(),
    ...timestamps,
  },
  (t) => [
    // Sert aussi d'index à la FK workspace_id.
    unique("shopping_aisle_order_workspace_user_unique").on(
      t.workspaceId,
      t.userId,
    ),
    // Au plus 12 rayons, tous connus. La permutation exacte est vérifiée par setAisleOrder.
    check(
      "shopping_aisle_order_keys_check",
      sql`cardinality(${t.aisleKeys}) <= 12 and ${t.aisleKeys} <@ array[${aisleList}]::text[]`,
    ),
    pgPolicy("shopping_aisle_order_select", {
      for: "select",
      to: appBackend,
      using: isMemberAndSelf(t.workspaceId, t.userId),
    }),
    pgPolicy("shopping_aisle_order_insert", {
      for: "insert",
      to: appBackend,
      withCheck: isMemberAndSelf(t.workspaceId, t.userId),
    }),
    pgPolicy("shopping_aisle_order_update", {
      for: "update",
      to: appBackend,
      using: isMemberAndSelf(t.workspaceId, t.userId),
      withCheck: isMemberAndSelf(t.workspaceId, t.userId),
    }),
  ],
).enableRLS();
