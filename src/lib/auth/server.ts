import { createNeonAuth } from "@neon/auth/next/server";
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

let instance: Auth | undefined;

/** Instance serveur Neon Auth, créée au premier appel (variables validées à ce moment). */
export function getAuth(): Auth {
  if (instance) return instance;
  const env = getAuthEnv();
  instance = createNeonAuth({
    baseUrl: env.NEON_AUTH_BASE_URL,
    cookies: {
      secret: env.NEON_AUTH_COOKIE_SECRET,
      // Explicite : la doc Neon annonce `strict` par défaut, le code du SDK 0.8.2 applique `lax`.
      // `lax` garde la session quand l'app est ouverte depuis un lien externe (e-mail, autre site).
      // Les cookies du SDK sont toujours HttpOnly, Secure et préfixés `__Secure-`.
      sameSite: "lax",
    },
    // Les journaux du SDK peuvent contenir des messages d'erreur amont : erreurs seules.
    logLevel: "error",
  }) as Auth;
  return instance;
}

export type Session = {
  user: { id: string };
};

/** Session de la requête courante, ou null. Lecture côté serveur uniquement (cookie signé). */
export async function getSession(): Promise<Session | null> {
  // Lecture liée à la requête : jamais pré-rendue au build.
  await connection();
  const { data } = await getAuth().getSession();
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
  const { data } = await getAuth().token();
  const token = data?.token;
  return typeof token === "string" && token !== "" ? token : null;
}
