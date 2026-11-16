"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { syncLocaleCookie } from "@/lib/locale-cookie";
import { requireSessionWithToken } from "@/lib/session";
import { runActionWithToken } from "@/modules/actions/run";
import { localeSchema } from "@/modules/core/schemas";

/** Réponse de la palette : rien d'autre qu'un succès ou un échec générique (aucun détail, ADR-009). */
export type RunActionResult = { ok: true; result: unknown } | { ok: false };

/**
 * Effets propres au web d'une action réussie (cookies, rendu) : le registre est sans Next, ils vivent ici.
 * Changer de langue : NEXT_LOCALE recopié depuis la langue enregistrée (ADR-007), route rafraîchie.
 */
async function applyWebEffects(name: string, result: unknown): Promise<void> {
  if (name !== "core.setLocale") return;
  await syncLocaleCookie(localeSchema.parse(result));
  refresh();
}

/**
 * Server Action unique de la palette (ADR-009) : session d'abord, puis registre. Le `workspaceId` est celui
 * de la session, l'utilisateur celui du jeton vérifié ; `name` et `params` viennent du client et ne servent
 * qu'à choisir et paramétrer l'action. Nom inconnu, paramètres invalides ou échec → `{ ok: false }`, rien
 * d'exécuté dans les deux premiers cas, aucun détail renvoyé ni journalisé.
 */
export async function runAction(
  name: unknown,
  params: unknown,
): Promise<RunActionResult> {
  const { session, token } = await requireSessionWithToken();
  try {
    const outcome = await runActionWithToken(
      token,
      session.workspaceId,
      name,
      params,
    );
    await applyWebEffects(outcome.name, outcome.result);
    return { ok: true, result: outcome.result };
  } catch (error) {
    // Erreurs de contrôle de Next (redirect, notFound) : jamais avalées (docs/gotchas.md).
    unstable_rethrow(error);
    console.warn("[actions] action refusée ou en échec");
    return { ok: false };
  }
}
