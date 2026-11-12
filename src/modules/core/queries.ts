import { and, asc, eq, sql } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { contexts, workspaceMembers, workspaces } from "@/db/schema/core";
import type { AppLocale } from "@/i18n/locales";

import {
  contextFilterSchema,
  localeSchema,
  parseInput,
  sideSchema,
  type Side,
  uuidSchema,
} from "./schemas";

// Lectures du module core (ADR-004) : nommées, typées, réutilisables par l'assistant.
// Chaque fonction reçoit la transaction ouverte par withUserDb (identité déjà appliquée, RLS active)
// et filtre en plus sur workspaceId (double verrou, ADR-002).

export type { Side } from "./schemas";

export type Workspace = { id: string; name: string };

export type Context = {
  id: string;
  name: string;
  side: Side;
  position: number | null;
};

/**
 * Premier workspace dont `userId` est membre (created_at puis id), ou null.
 * Exception à « workspaceId en premier » : c'est cette lecture qui le produit (requireSession, tâche 11).
 * `userId` doit être l'utilisateur de la session (app.current_user_id()) : sinon null, même pour un co-membre.
 */
export async function getWorkspaceForUser(
  userId: string,
  tx: UserTx,
): Promise<Workspace | null> {
  const user = parseInput(uuidSchema, userId);
  const rows = await tx
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(
      and(
        eq(workspaceMembers.userId, user),
        // userId ne peut désigner que l'utilisateur de la session : la RLS laisse voir les co-membres.
        eq(workspaceMembers.userId, sql`(select app.current_user_id())`),
      ),
    )
    .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
    .limit(1);
  return rows[0] ?? null;
}

/** Contextes d'un côté (Privé / Pro) du workspace, triés par position puis nom. */
export async function listContexts(
  workspaceId: string,
  filter: { side: Side },
  tx: UserTx,
): Promise<Context[]> {
  const workspace = parseInput(uuidSchema, workspaceId);
  const { side } = parseInput(contextFilterSchema, filter);
  const rows = await tx
    .select({
      id: contexts.id,
      name: contexts.name,
      kind: contexts.kind,
      position: contexts.position,
    })
    .from(contexts)
    .where(and(eq(contexts.workspaceId, workspace), eq(contexts.kind, side)))
    .orderBy(asc(contexts.position), asc(contexts.name));
  return rows.map(({ kind, ...rest }) => ({
    ...rest,
    // CHECK contexts_kind_check : kind ∈ ('private', 'pro') ; validé quand même, pas de cast.
    side: sideSchema.parse(kind),
  }));
}

/** Langue de l'utilisateur de la session dans le workspace ; null si userId n'est pas lui ou n'est pas membre. */
export async function getMemberLocale(
  workspaceId: string,
  userId: string,
  tx: UserTx,
): Promise<AppLocale | null> {
  const workspace = parseInput(uuidSchema, workspaceId);
  const user = parseInput(uuidSchema, userId);
  const rows = await tx
    .select({ locale: workspaceMembers.locale })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace),
        eq(workspaceMembers.userId, user),
        // Sa propre langue seulement (l'assistant ne lit pas celle d'un co-membre que la RLS laisse voir).
        eq(workspaceMembers.userId, sql`(select app.current_user_id())`),
      ),
    )
    .limit(1);
  const locale = rows[0]?.locale;
  // CHECK workspace_members_locale_check : locale ∈ ('fr', 'en').
  return locale === undefined ? null : localeSchema.parse(locale);
}

export type Membership = {
  workspace: Workspace | null;
  locale: AppLocale | null;
};

/**
 * Workspace et langue de l'utilisateur de la session (requireSession), en une requête : même choix de
 * workspace que getWorkspaceForUser (le plus ancien), langue de son appartenance à ce workspace.
 * Sans appartenance : `{ workspace: null, locale: null }`, rien n'est créé.
 */
export async function getMembership(
  userId: string,
  tx: UserTx,
): Promise<Membership> {
  const user = parseInput(uuidSchema, userId);
  const rows = await tx
    .select({
      id: workspaces.id,
      name: workspaces.name,
      locale: workspaceMembers.locale,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(
      and(
        eq(workspaceMembers.userId, user),
        // Sa propre appartenance seulement (la RLS laisse voir les co-membres).
        eq(workspaceMembers.userId, sql`(select app.current_user_id())`),
      ),
    )
    .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
    .limit(1);
  const row = rows[0];
  if (!row) return { workspace: null, locale: null };
  // CHECK workspace_members_locale_check : locale ∈ ('fr', 'en').
  return {
    workspace: { id: row.id, name: row.name },
    locale: localeSchema.parse(row.locale),
  };
}
