import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { appOrigin, returnPath } from "@/lib/auth/return-path";
import { getSessionToken } from "@/lib/auth/server";
import { LOGIN_PATH, NO_WORKSPACE_PATH } from "@/lib/auth/routes";
import { isRejectedToken, resolveMembership } from "@/modules/core/membership";

import { syncLocaleCookie } from "./locale-cookie";

export type AppSession = {
  /** `sub` du JWT vérifié par withUserDb (jamais le cache de getSession()). */
  userId: string;
  workspaceId: string;
  /** Saisi par l'utilisateur : affiché tel quel, jamais traduit. */
  workspaceName: string;
};

export type ResolvedSession = { session: AppSession; token: string };

/**
 * Renvoi vers /login, session absente ou refusée. Depuis une Server Action (en-tête Next-Action), la page
 * d'origine est l'en-tête Referer : son chemin seul part en `next` s'il est de la même origine que l'app
 * (returnPath), revalidé à la connexion. Pendant le rendu d'une page, le Referer est la page précédente,
 * pas celle demandée : pas de `next` (retour au tableau de bord).
 */
async function redirectToLogin(): Promise<never> {
  const request = await headers();
  const next = request.has("next-action")
    ? returnPath(request.get("referer"), appOrigin(request))
    : null;
  redirect(
    next ? `${LOGIN_PATH}?${new URLSearchParams({ next })}` : LOGIN_PATH,
  );
}

async function loadSession(): Promise<ResolvedSession> {
  // Session refusée par Neon Auth (401…) → null ; Neon Auth indisponible → AuthUnavailableError, qui remonte.
  const token = await getSessionToken();
  if (!token) return redirectToLogin();

  // Vérifie le jeton (signature, iss, aud, exp) et lit l'appartenance en une seule transaction.
  // Jeton refusé (expiré entre-temps, signature) → /login ; toute autre erreur remonte.
  let membership: Awaited<ReturnType<typeof resolveMembership>>;
  try {
    membership = await resolveMembership(token);
  } catch (error) {
    if (isRejectedToken(error)) return redirectToLogin();
    throw error;
  }
  const { userId, workspace } = membership;
  // Pas de création automatique ; la page cible est hors de (app) : pas de boucle.
  if (!workspace) redirect(NO_WORKSPACE_PATH);
  // Langue : pas de recopie ici (aucune écriture de cookie pendant un rendu). NEXT_LOCALE est recopié
  // à la connexion (syncSessionLocale) et au changement de langue (tâche 16).

  return {
    session: {
      userId,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    },
    token,
  };
}

// Mémoïsée par `cache` de React : le cache vit le temps d'un rendu (une requête) et n'est jamais
// partagé entre requêtes ; hors rendu (Server Action), chaque appel refait la vérification.
const resolveSession = cache(loadSession);

/**
 * Session serveur résolue : utilisateur et workspace, sans le jeton (rien de secret si elle est
 * passée à un composant client). Sans session, session refusée par Neon Auth ou jeton refusé → /login
 * (`?next=<chemin>` depuis une Server Action, voir redirectToLogin) ; sans workspace → /no-workspace (les
 * deux par `redirect`, qui interrompt aussi une Server Action). Auth indisponible (AuthUnavailableError) →
 * l'erreur remonte (page d'erreur), jamais /login.
 * À appeler dans chaque page de (app), chaque lecture de données et au début de chaque Server Action
 * non publique (règle frontend.md « Session ») : ni le proxy ni le layout ne suffisent.
 */
export async function requireSession(): Promise<AppSession> {
  return (await resolveSession()).session;
}

/**
 * JWT Neon Auth de la session résolue, à passer à withUserDb par les lectures et écritures serveur
 * (modules). Mêmes garanties et même cache que requireSession : aucune seconde vérification dans un
 * rendu. Secret de session : ne jamais le passer à un composant client, le journaliser ni le renvoyer
 * d'une Server Action.
 */
export async function requireSessionToken(): Promise<string> {
  return (await resolveSession()).token;
}

/**
 * Session et JWT d'une seule résolution, pour une Server Action qui écrit en base : hors rendu, `cache` ne
 * mémoïse pas, et requireSession puis requireSessionToken vérifieraient le jeton deux fois. Garde reconnue
 * en première instruction, au même titre que requireSession (tests/lint/unguarded-actions.ts). Mêmes
 * redirections ; le jeton reste un secret (jamais renvoyé au client ni journalisé).
 */
export async function requireSessionWithToken(): Promise<ResolvedSession> {
  return resolveSession();
}

/**
 * Juste après une connexion réussie (action signIn) : recopie la langue enregistrée du membre dans
 * NEXT_LOCALE. Le JWT est obtenu avec les cookies que la connexion vient de poser (magasin de cookies de
 * l'action). Ne redirige pas et ne lève jamais : un échec n'empêche pas la connexion, la langue sera
 * recopiée à la prochaine action. Journal sans donnée (ni identifiant, ni message d'erreur).
 */
export async function syncSessionLocale(): Promise<void> {
  try {
    const token = await getSessionToken();
    if (!token) return;
    const { workspace, locale } = await resolveMembership(token);
    if (workspace && locale) await syncLocaleCookie(locale);
  } catch {
    console.warn("[session] langue non recopiée après connexion");
  }
}
