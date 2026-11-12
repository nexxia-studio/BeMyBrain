import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getSessionToken } from "@/lib/auth/server";
import { LOGIN_PATH, NO_WORKSPACE_PATH } from "@/lib/auth/routes";
import { resolveMembership } from "@/modules/core/membership";

import { syncLocaleCookie } from "./locale-cookie";

export type AppSession = {
  /** `sub` du JWT vérifié par withUserDb (jamais le cache de getSession()). */
  userId: string;
  workspaceId: string;
  /** Saisi par l'utilisateur : affiché tel quel, jamais traduit. */
  workspaceName: string;
};

type ResolvedSession = { session: AppSession; token: string };

async function loadSession(): Promise<ResolvedSession> {
  const token = await getSessionToken();
  if (!token) redirect(LOGIN_PATH);

  // Vérifie le jeton (signature, iss, aud, exp) et lit l'appartenance en une seule transaction.
  const { userId, workspace } = await resolveMembership(token);
  // Pas de création automatique ; la page cible est hors de (app) : pas de boucle.
  if (!workspace) redirect(NO_WORKSPACE_PATH);
  // Langue : pas de recopie ici (aucune écriture de cookie pendant un rendu). NEXT_LOCALE est recopié
  // à la connexion (syncSessionLocale) et au changement de langue (tâche 16).

  return {
    session: { userId, workspaceId: workspace.id, workspaceName: workspace.name },
    token,
  };
}

// Mémoïsée par `cache` de React : le cache vit le temps d'un rendu (une requête) et n'est jamais
// partagé entre requêtes ; hors rendu (Server Action), chaque appel refait la vérification.
const resolveSession = cache(loadSession);

/**
 * Session serveur résolue : utilisateur et workspace, sans le jeton (rien de secret si elle est
 * passée à un composant client). Sans session → /login ; sans workspace → /no-workspace (les deux par
 * `redirect`, qui interrompt aussi une Server Action). Auth indisponible (AuthUnavailableError) →
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
