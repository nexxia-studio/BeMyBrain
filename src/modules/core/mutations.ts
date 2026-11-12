import { and, eq } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import { workspaceMembers } from "@/db/schema/core";
import type { AppLocale } from "@/i18n/locales";

import { CoreError } from "./errors";
import { localeSchema, parseInput, uuidSchema } from "./schemas";

// Écritures du module core. Même contrat que queries.ts : transaction de withUserDb en dernier
// argument, filtre explicite sur workspaceId (et userId) en plus de la RLS (ADR-002).

/**
 * Change la langue du membre (workspaceId, userId) et renvoie la langue appliquée.
 * Aucune ligne touchée (autre membre : policy update_own ; autre workspace ; appartenance absente)
 * → CoreError("member_not_found").
 */
export async function setMemberLocale(
  workspaceId: string,
  userId: string,
  locale: AppLocale,
  tx: UserTx,
): Promise<AppLocale> {
  const workspace = parseInput(uuidSchema, workspaceId);
  const user = parseInput(uuidSchema, userId);
  const next = parseInput(localeSchema, locale);
  const rows = await tx
    .update(workspaceMembers)
    .set({ locale: next })
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspace),
        eq(workspaceMembers.userId, user),
      ),
    )
    .returning({ locale: workspaceMembers.locale });
  if (rows.length !== 1) throw new CoreError("member_not_found");
  return next;
}
