import { and, asc, eq } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { contexts, workspaceMembers, workspaces } from "@/db/schema/core";
import type { AppLocale } from "@/i18n/locales";

import {
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
    .where(eq(workspaceMembers.userId, user))
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
  const side = parseInput(sideSchema, filter.side);
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
    // CHECK contexts_kind_check : kind ∈ ('private', 'pro').
    side: kind as Side,
  }));
}

/** Langue d'un membre du workspace, ou null s'il n'en est pas membre (ou que la RLS le masque). */
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
      ),
    )
    .limit(1);
  const locale = rows[0]?.locale;
  // CHECK workspace_members_locale_check : locale ∈ ('fr', 'en').
  return locale === undefined ? null : localeSchema.parse(locale);
}
