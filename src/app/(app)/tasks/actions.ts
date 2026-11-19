"use server";

import { requireSessionWithToken } from "@/lib/session";
import {
  TASK_ERROR_MESSAGES,
  type TaskErrorCode,
} from "@/modules/tasks/errors";

import { runWebAction } from "../web-action";

/**
 * Issue renvoyée aux écrans. `code` : seulement un code traduit par `tasks.errors.*` (codes de
 * `TaskError`) ; tout autre refus (`unknown_action`, `missing_context`, codes d'un autre module,
 * `invalid_error_code`) et toute panne → `{ ok: false }` sans code, message générique côté écran.
 */
export type AppActionResult =
  { ok: true; result: unknown } | { ok: false; code?: TaskErrorCode };

function isTaskErrorCode(code: string): code is TaskErrorCode {
  return Object.hasOwn(TASK_ERROR_MESSAGES, code);
}

/**
 * Server Action des écrans de l'app (liste, détail, corbeille, ajout rapide) : toute écriture passe par
 * le registre (ADR-009), jamais par `mutations.ts`. Session d'abord ; origine toujours `app`, jamais lue
 * des arguments. Côté client : appeler par `settleAction`.
 */
// raccourci: toute action du canal web est appelable ici, comme par la palette (aucun gain de sécurité à filtrer `tasks.*`) — restreindre si un écran ne doit jamais déclencher une action d'un autre module.
export async function runAppAction(
  name: unknown,
  params: unknown,
): Promise<AppActionResult> {
  const { session, token } = await requireSessionWithToken();
  const outcome = await runWebAction(
    token,
    session.workspaceId,
    "app",
    name,
    params,
  );
  if (outcome.ok) return outcome;
  return outcome.code !== undefined && isTaskErrorCode(outcome.code)
    ? { ok: false, code: outcome.code }
    : { ok: false };
}
