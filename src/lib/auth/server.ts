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

// raccourci: pas de `server-only` (paquet non installé) — réévalué à la tâche 11 (plan socle).

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

/**
 * Contexte de requête de l'instance de lecture : même chose que l'adaptateur Next du SDK, sauf que
 * l'écriture d'un cookie pendant un rendu est ignorée (le proxy porte le renouvellement de session).
 * Toute autre erreur d'écriture remonte.
 */
async function readContext(): Promise<RequestContext> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return {
    getCookies: () => extractNeonAuthCookies(headerStore),
    setCookie(name, value, options) {
      try {
        cookieStore.set(name, value, options);
      } catch (error) {
        if (error instanceof Error && RENDER_COOKIE_WRITE.test(error.message))
          return;
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

/** Session de la requête courante, ou null. Lecture côté serveur uniquement (cookie signé). */
export async function getSession(): Promise<Session | null> {
  // Lecture liée à la requête : jamais pré-rendue au build.
  await connection();
  const { data } = await getReadAuth().getSession();
  const id = data?.user?.id;
  return typeof id === "string" ? { user: { id } } : null;
}

/**
 * JWT Neon Auth de la session courante (EdDSA, 15 min), à passer à withUserDb, ou null.
 * Attention : `session.token` renvoyé par getSession() côté serveur est le jeton de session opaque,
 * pas ce JWT. Le JWT vient de l'endpoint `/token` (plugin JWT de Neon Auth).
 */
export async function getSessionToken(): Promise<string | null> {
  await connection();
  const { data } = await getReadAuth().token();
  const token = data?.token;
  return typeof token === "string" && token !== "" ? token : null;
}
