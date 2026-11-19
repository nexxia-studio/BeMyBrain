"use server";

import { requireSessionWithToken } from "@/lib/session";

import { runWebAction } from "./web-action";

/** Réponse de la palette : rien d'autre qu'un succès ou un échec générique (aucun détail, ADR-009). */
export type RunActionResult = { ok: true; result: unknown } | { ok: false };

/**
 * Server Action unique de la palette (ADR-009) : session d'abord, puis registre (`runWebAction`, qui porte
 * le traitement des refus, des pannes et des effets web). Le `workspaceId` est celui de la session,
 * l'utilisateur celui du jeton vérifié, l'origine toujours `palette`. La palette n'affiche qu'un échec
 * générique : le code d'un refus attendu n'est pas renvoyé.
 */
export async function runAction(
  name: unknown,
  params: unknown,
): Promise<RunActionResult> {
  const { session, token } = await requireSessionWithToken();
  const outcome = await runWebAction(
    token,
    session.workspaceId,
    "palette",
    name,
    params,
  );
  return outcome.ok ? outcome : { ok: false };
}
