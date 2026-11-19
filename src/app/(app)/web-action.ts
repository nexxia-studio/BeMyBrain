// Appelé seulement par les Server Actions de (app), après leur garde de session ; jamais côté client.
import "server-only";

import { captureException } from "@sentry/nextjs";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { DomainError } from "@/lib/errors";
import { syncLocaleCookie } from "@/lib/locale-cookie";
import { redirectIfRejectedToken } from "@/lib/session";
import { type ActionOutcome, runActionWithToken } from "@/modules/actions/run";
import type { WebActionOrigin } from "@/modules/actions/types";
import { localeSchema } from "@/modules/core/schemas";

/**
 * Issue d'une action du canal web. `code` : code stable d'un refus attendu (DomainError), traduit par
 * l'écran ; absent pour une panne. Jamais de texte de la base ni de valeur reçue.
 */
export type WebActionResult =
  { ok: true; result: unknown } | { ok: false; code?: string };

/**
 * Effets propres au web d'une action réussie (cookies, rendu) : le registre est sans Next, ils vivent ici.
 * Changer de langue : NEXT_LOCALE recopié depuis la langue enregistrée (ADR-007). Toute écriture : route
 * rafraîchie (liste, détail, tuiles relus) ; une lecture ne touche pas au rendu.
 */
async function applyWebEffects(outcome: ActionOutcome): Promise<void> {
  if (outcome.name === "core.setLocale")
    await syncLocaleCookie(localeSchema.parse(outcome.result));
  if (outcome.access === "write") refresh();
}

// Forme d'un nom du registre (`module.action`) : seul ce qui y ressemble part en tag, jamais un texte libre.
const ACTION_NAME = /^[a-z]+\.[A-Za-z]+$/;

function captureActionFailure(error: unknown, name: unknown): void {
  captureException(error, {
    tags: {
      action:
        typeof name === "string" && ACTION_NAME.test(name) ? name : "invalid",
    },
  });
}

/**
 * Exécute une action du registre pour une Server Action déjà gardée (ADR-009). `token` et `workspaceId`
 * viennent de la session, `origin` est posée en dur par la Server Action appelante ; `name` et `params`
 * viennent du client et ne servent qu'à choisir et paramétrer l'action, jamais journalisés.
 * Refus attendu (DomainError : nom inconnu, paramètres invalides, contexte incomplet, refus métier d'un
 * module) → `{ ok: false, code }`, seul le code est journalisé.
 * Toute autre erreur (base, identité non appliquée…) est une panne : journalisée côté serveur
 * (`console.error`, l'erreur seule) et envoyée à Sentry, puis `{ ok: false }`.
 * Une fois l'action réussie, l'écriture est faite : un échec des effets web (cookie, rendu) est journalisé
 * et envoyé à Sentry mais n'annonce pas un échec trompeur.
 * Sentry ne reçoit que l'erreur et le nom de l'action en tag, le journal que l'erreur : ni paramètres, ni
 * session, ni jeton.
 */
export async function runWebAction(
  token: string,
  workspaceId: string,
  origin: WebActionOrigin,
  name: unknown,
  params: unknown,
): Promise<WebActionResult> {
  let outcome: ActionOutcome;
  try {
    outcome = await runActionWithToken(
      token,
      workspaceId,
      origin,
      name,
      params,
    );
  } catch (error) {
    // Erreurs de contrôle de Next (redirect, notFound) : jamais avalées (docs/gotchas.md).
    unstable_rethrow(error);
    // Jeton expiré entre la garde et la base : renvoi vers /login, pas une panne (QA-1).
    await redirectIfRejectedToken(error);
    // Refus métier (registre ou module : ActionError, TaskError, CoreError…) : attendu, pas une panne.
    if (error instanceof DomainError) {
      console.warn("[actions] action refusée", { code: error.code });
      return { ok: false, code: error.code };
    }
    // Journal serveur gardé avec Sentry : inactif en local et en CI, quota ou panne possibles en production.
    console.error("[actions] action en échec", error);
    captureActionFailure(error, name);
    return { ok: false };
  }
  try {
    await applyWebEffects(outcome);
  } catch (error) {
    unstable_rethrow(error);
    console.error("[actions] effets web en échec après l'action", error);
    captureActionFailure(error, outcome.name);
  }
  return { ok: true, result: outcome.result };
}
