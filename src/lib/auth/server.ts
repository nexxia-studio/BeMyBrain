// `server-only` : fourni par Next (alias du compilateur vers next/dist/compiled/server-only), pas de
// dépendance ajoutée. Ce module lit le secret des cookies : jamais dans un bundle client.
import "server-only";

import { createNeonAuth } from "@neon/auth/next/server";
import {
  createAuthServer,
  extractNeonAuthCookies,
  resolveNeonAuthLogging,
  type RequestContext,
} from "@neon/auth/server";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";

import { getAuthEnv } from "@/env";

type AuthResult<T> = Promise<{
  data: T | null;
  error: { code?: string; status?: number } | null;
}>;

// Le SDK 0.8.2 type `token` et `emailOtp` en `unknown` (types des plugins JWT et Email OTP absents
// de son client) alors que les endpoints existent (API_ENDPOINTS du SDK). Typés ici, au plus juste :
// corps et réponses de Better Auth 1.7 (plugins jwt et email-otp).
type PluginEndpoints = {
  token: () => AuthResult<{ token: string }>;
  emailOtp: {
    sendVerificationOtp: (body: {
      email: string;
      type: "forget-password";
    }) => AuthResult<{ success: boolean }>;
    resetPassword: (body: {
      email: string;
      otp: string;
      password: string;
    }) => AuthResult<{ success: boolean }>;
  };
};

type Auth = ReturnType<typeof createNeonAuth> & PluginEndpoints;
type ReadAuth = ReturnType<typeof createAuthServer> & PluginEndpoints;

// Explicite : la doc Neon annonce `strict` par défaut, le code du SDK 0.8.2 applique `lax`.
// `lax` garde la session quand l'app est ouverte depuis un lien externe (e-mail, autre site).
// Les cookies du SDK sont toujours HttpOnly, Secure et préfixés `__Secure-`.
const SAME_SITE = "lax";
// Les journaux du SDK peuvent contenir des messages d'erreur amont : erreurs seules.
const LOG_LEVEL = "error";

let instance: Auth | undefined;
let readInstance: ReadAuth | undefined;

/** Instance serveur Neon Auth, créée au premier appel (variables validées à ce moment). */
export function getAuth(): Auth {
  if (instance) return instance;
  const env = getAuthEnv();
  instance = createNeonAuth({
    baseUrl: env.NEON_AUTH_BASE_URL,
    cookies: {
      secret: env.NEON_AUTH_COOKIE_SECRET,
      sameSite: SAME_SITE,
    },
    logLevel: LOG_LEVEL,
  }) as Auth;
  return instance;
}

// Erreur levée par Next quand on écrit un cookie pendant le rendu d'un Server Component.
// Classe non exportée publiquement : reconnue à son message, figé par un test sur le vrai magasin scellé.
const RENDER_COOKIE_WRITE =
  /^Cookies can only be modified in a Server Action or Route Handler/;

/** Vrai si `error` est le refus de Next d'écrire un cookie pendant un rendu de Server Component. */
export function isRenderCookieWriteError(error: unknown): boolean {
  return error instanceof Error && RENDER_COOKIE_WRITE.test(error.message);
}

// Cookie de session du SDK @neon/auth : sans lui, aucune session à demander.
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

/** Retire les guillemets d'une valeur RFC 6265 « quoted-string », comme le parseur de Better Auth. */
function unquote(value: string) {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/**
 * Cookies Neon Auth envoyés à l'auth, lus dans le magasin de cookies de Next et non dans l'en-tête :
 * dans une action, il reflète ceux posés plus tôt dans la même requête (JWT demandé juste après la
 * connexion), et pendant un rendu ceux que le proxy a renouvelés. Next a décodé les valeurs : on
 * reforme un en-tête Cookie (guillemets retirés, valeurs réencodées) et on le passe au parseur du SDK,
 * pour envoyer exactement ce que `extractNeonAuthCookies` enverrait. Valeurs vides (cookie effacé) ignorées.
 */
function authCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return extractNeonAuthCookies(
    cookieStore
      .getAll()
      .filter(({ value }) => value !== "")
      .map(
        ({ name, value }) => `${name}=${encodeURIComponent(unquote(value))}`,
      )
      .join("; "),
  );
}

/**
 * Contexte de requête de l'instance de lecture : même chose que l'adaptateur Next du SDK, sauf que
 * l'écriture d'un cookie pendant un rendu est ignorée (le proxy porte le renouvellement de session),
 * et que les cookies viennent du magasin de Next (voir authCookies).
 * Toute autre erreur d'écriture remonte.
 */
async function readContext(): Promise<RequestContext> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return {
    getCookies: () => authCookies(cookieStore),
    setCookie(name, value, options) {
      try {
        cookieStore.set(name, value, options);
      } catch (error) {
        if (isRenderCookieWriteError(error)) return;
        throw error;
      }
    },
    getHeader: (name) => headerStore.get(name),
    getOrigin: () =>
      headerStore.get("origin") ??
      headerStore.get("referer")?.split("/").slice(0, 3).join("/") ??
      "",
    getFramework: () => "nextjs",
  };
}

/** Instance de lecture (session, JWT), sûre dans un Server Component. */
function getReadAuth(): ReadAuth {
  if (readInstance) return readInstance;
  const env = getAuthEnv();
  readInstance = createAuthServer({
    baseUrl: env.NEON_AUTH_BASE_URL,
    context: readContext,
    cookieSecret: env.NEON_AUTH_COOKIE_SECRET,
    sameSite: SAME_SITE,
    log: resolveNeonAuthLogging({ logLevel: LOG_LEVEL }),
  }) as ReadAuth;
  return readInstance;
}

export type Session = {
  user: { id: string };
};

type AuthErrorLike = { code?: unknown; status?: unknown } | null | undefined;

/** Panne ou saturation de Neon Auth : transport, 5xx ou limite de tentatives (429). */
export function isAuthUnavailable(error: AuthErrorLike): boolean {
  const status = typeof error?.status === "number" ? error.status : 0;
  return (
    status >= 500 ||
    status === 429 ||
    (typeof error?.code === "string" && error.code.startsWith("NETWORK_"))
  );
}

/**
 * Neon Auth ne répond pas (panne, 5xx, 429) : la session ne peut être ni confirmée ni refusée.
 * Mène à la page d'erreur, jamais à /login. Message fixe, sans cause chaînée.
 */
export class AuthUnavailableError extends Error {
  readonly status: number | undefined;
  constructor(status?: number) {
    super("Service d'authentification indisponible");
    this.name = "AuthUnavailableError";
    this.status = status;
  }
}

/**
 * Appelle l'auth et sépare les trois issues : réponse (data, éventuellement vide), pas de session (null),
 * indisponibilité (AuthUnavailableError). Sans cookie de session, n'appelle rien.
 * Une configuration invalide (variables d'environnement) remonte telle quelle, pour le diagnostic,
 * au lieu de passer pour une panne de l'auth.
 */
async function callAuth<T>(
  call: (auth: ReadAuth) => AuthResult<T>,
): Promise<T | null> {
  await connection();
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return null;
  const auth = getReadAuth();
  // Le SDK renvoie les pannes de transport classées (code NETWORK_*) ; ce qu'il lève est imprévu
  // (ex. écriture de cookie refusée) et remonte tel quel.
  const { data, error } = await call(auth);
  if (isAuthUnavailable(error)) {
    throw new AuthUnavailableError(
      typeof error?.status === "number" ? error.status : undefined,
    );
  }
  return error ? null : data;
}

/**
 * Session de la requête courante, ou null (pas de session). Auth indisponible → AuthUnavailableError.
 * Lecture côté serveur uniquement (cookie signé).
 */
export async function getSession(): Promise<Session | null> {
  // Lecture liée à la requête : jamais pré-rendue au build (connection() dans callAuth).
  const data = await callAuth(
    (auth) =>
      auth.getSession() as AuthResult<{ user?: { id?: unknown } } | null>,
  );
  const id = data?.user?.id;
  return typeof id === "string" ? { user: { id } } : null;
}

/**
 * JWT Neon Auth de la session courante (EdDSA, 15 min), à passer à withUserDb.
 * null = pas de session (aucun cookie de session, ou refus de l'auth : 401…) → /login.
 * Auth indisponible (5xx, 429, réseau) → AuthUnavailableError : une panne ne déconnecte pas.
 * Configuration invalide → erreur de configuration, distincte.
 * Attention : `session.token` renvoyé par getSession() côté serveur est le jeton de session opaque,
 * pas ce JWT. Le JWT vient de l'endpoint `/token` (plugin JWT de Neon Auth).
 */
export async function getSessionToken(): Promise<string | null> {
  const data = await callAuth((auth) => auth.token());
  const token = data?.token;
  return typeof token === "string" && token !== "" ? token : null;
}
