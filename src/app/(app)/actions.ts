"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { syncLocaleCookie } from "@/lib/locale-cookie";
import { requireSessionWithToken } from "@/lib/session";
import { ActionError } from "@/modules/actions/errors";
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
 * qu'à choisir et paramétrer l'action, jamais journalisés. Nom inconnu, paramètres invalides ou contexte
 * incomplet (ActionError, refus attendu) → `{ ok: false }`, rien d'exécuté, seul le code est journalisé.
 * Toute autre erreur (base, identité non appliquée…) est une panne : journalisée en erreur, puis `{ ok: false }`.
 * Une fois l'action réussie, l'écriture est faite : un échec des effets web (cookie, rendu) est journalisé
 * mais n'annonce pas un échec trompeur (la langue enregistrée sera recopiée à la prochaine connexion).
 */
export async function runAction(
  name: unknown,
  params: unknown,
): Promise<RunActionResult> {
  const { session, token } = await requireSessionWithToken();
  let outcome: Awaited<ReturnType<typeof runActionWithToken>>;
  try {
    outcome = await runActionWithToken(
      token,
      session.workspaceId,
      name,
      params,
    );
  } catch (error) {
    // Erreurs de contrôle de Next (redirect, notFound) : jamais avalées (docs/gotchas.md).
    unstable_rethrow(error);
    if (error instanceof ActionError) {
      console.warn("[actions] action refusée", { code: error.code });
      return { ok: false };
    }
    // raccourci: journal serveur seulement — captureException de Sentry à la tâche 19.
    console.error("[actions] action en échec", error);
    return { ok: false };
  }
  try {
    await applyWebEffects(outcome.name, outcome.result);
  } catch (error) {
    unstable_rethrow(error);
    // raccourci: journal serveur seulement — captureException de Sentry à la tâche 19.
    console.error("[actions] effets web en échec après l'action", error);
  }
  return { ok: true, result: outcome.result };
}
