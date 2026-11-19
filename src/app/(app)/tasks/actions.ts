"use server";

import { requireSessionWithToken } from "@/lib/session";

import { runWebAction, type WebActionResult } from "../web-action";

/**
 * Server Action des écrans de tâches (liste, détail, corbeille, ajout rapide) : toute écriture passe par
 * le registre (ADR-009), jamais par `mutations.ts`. Session d'abord ; origine toujours `app`, jamais lue
 * des arguments. Refus attendu → `{ ok: false, code }` (code traduit par `tasks.errors.*`), panne →
 * `{ ok: false }` sans code. Côté client : appeler par `settleAction`.
 */
// raccourci: toute action du canal web est appelable ici, comme par la palette (aucun gain de sécurité à filtrer `tasks.*`) — restreindre si un écran ne doit jamais déclencher une action d'un autre module.
export async function runTaskAction(
  name: unknown,
  params: unknown,
): Promise<WebActionResult> {
  const { session, token } = await requireSessionWithToken();
  return runWebAction(token, session.workspaceId, "app", name, params);
}
