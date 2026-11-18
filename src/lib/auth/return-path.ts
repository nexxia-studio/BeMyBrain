// Chemin de retour après connexion (QA-1). Fonctions pures, sans Next : appelées par la session (renvoi
// vers /login depuis une action) et revalidées à la connexion (action signIn, page /login).

import { LOGIN_PATH } from "./routes";

// Caractères de contrôle et blancs : l'analyseur d'URL retire tabulations et sauts de ligne
// (« /\t/evil » deviendrait « //evil »), on refuse la valeur entière plutôt que de la nettoyer.
const UNSAFE_CHARACTERS = /[\s\\\p{Cc}]/u;
// Barres encodées (`%2F`, `%5C`, toutes casses) : un décodage plus loin (navigateur, proxy) en referait
// `//` ou `\` ; aucune page de l'app n'en a besoin.
const ENCODED_SLASH = /%(2f|5c)/i;

function isLoginPath(pathname: string) {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}

/**
 * Chemin interne à reprendre après connexion, ou null (→ /dashboard).
 * `value` : un chemin (`/settings`, paramètre `next`) ou une URL complète (en-tête `Referer`).
 * Retenu seulement si son origine est exactement `origin` (schéma, hôte et port) ; seul le chemin est gardé,
 * sans paramètres d'URL ni fragment. Refusés : `//…`, tout `\`, `%2F` et `%5C`, blancs et caractères de contrôle, chemin non
 * relatif à la racine, autre origine, /login lui-même.
 */
export function returnPath(
  value: string | null | undefined,
  origin: string | null,
): string | null {
  if (!value || !origin || UNSAFE_CHARACTERS.test(value)) return null;
  if (value.startsWith("//")) return null;
  const isPath = value.startsWith("/");
  if (!isPath && !/^https?:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const { pathname } = url;
  // Garde finale sur le chemin normalisé (`/./`, `/../`) : toujours relatif à la racine, jamais `//`.
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  // Sur le chemin gardé seulement : des paramètres d'URL encodés (jetés) n'empêchent pas le retour.
  if (ENCODED_SLASH.test(pathname)) return null;
  if (isLoginPath(pathname)) return null;
  return pathname;
}

// Un hôte valide (nom ou adresse, port facultatif) : rien d'autre qu'un hôte ne doit entrer dans l'origine.
const HOST = /^[a-z0-9.-]+(?::\d{1,5})?$|^\[[0-9a-f:.]+\](?::\d{1,5})?$/i;

function first(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

/**
 * Origine de l'app pour la requête courante : `x-forwarded-proto` + `x-forwarded-host` (sinon `host`).
 * C'est la référence de la garde CSRF des Server Actions de Next (Origin comparée à l'hôte). Sur Vercel,
 * ces en-têtes sont posés par la plateforme ; ailleurs, un client qui les falsifie ne trompe que sa propre
 * réponse. Choix assumé (aucune variable d'URL d'app : les previews ont des URL changeantes) : l'origine
 * ne sert qu'à écarter un Referer étranger, le résultat est réduit à un chemin et revalidé à la connexion.
 */
export function appOrigin(headers: Pick<Headers, "get">): string | null {
  const proto = first(headers.get("x-forwarded-proto"));
  const host =
    first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if ((proto !== "http" && proto !== "https") || !host || !HOST.test(host))
    return null;
  // Forme normalisée (port par défaut retiré), comparable à `URL.origin`.
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}
