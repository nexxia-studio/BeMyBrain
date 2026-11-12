import { z } from "zod";

// Imports relatifs : ce fichier est aussi chargé par drizzle.config.ts, hors alias tsconfig.
import { parseEnv, type EnvSource } from "./db/parse-env";
import { assertSameHost } from "./db/production-guard";

const httpsUrl = () => z.url({ protocol: /^https$/ });

// Variables lues par l'app au runtime. L'URL propriétaire (DATABASE_URL) n'y figure pas :
// l'app ne parle à la base qu'avec le rôle restreint app_backend (ADR-002).
// Les variables des migrations vivent dans src/db/migration-env.ts.
const appEnvSchema = z.object({
  DATABASE_AUTHENTICATED_URL: z.url(),
  NEON_AUTH_BASE_URL: httpsUrl(),
  NEON_AUTH_JWKS_URL: httpsUrl(),
  // iss et aud exacts des jetons Neon Auth de la branche : l'origine de NEON_AUTH_BASE_URL
  // (doc Neon « JWT », vérifiée le 2026-11-12). Vérifiés par withUserDb.
  NEON_AUTH_ISSUER: httpsUrl(),
  NEON_AUTH_AUDIENCE: httpsUrl(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function parseAppEnv(source: EnvSource): AppEnv {
  // L'URL propriétaire n'existe jamais au runtime Vercel (ADR-010).
  if (source.VERCEL === "1" && source.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL est définie au runtime Vercel : retirer cette variable du projet Vercel (ADR-010).",
    );
  }
  const env = parseEnv(appEnvSchema, source);
  // Si l'URL propriétaire est aussi définie (local), elle doit viser la même branche.
  assertSameHost(source, "DATABASE_URL", "DATABASE_AUTHENTICATED_URL");
  return env;
}

let appEnv: AppEnv | undefined;

/** Variables de l'app, validées au premier accès. */
export function getAppEnv(): AppEnv {
  appEnv ??= parseAppEnv(process.env);
  return appEnv;
}

// Variables du SDK Neon Auth (connexion, session, proxy). Sans connexion à la base :
// l'écran de connexion et le proxy n'en ont pas besoin.
const authEnvSchema = z.object({
  NEON_AUTH_BASE_URL: httpsUrl(),
  // Signe le cookie de cache de session (HMAC-SHA256) ; le SDK exige 32 caractères minimum.
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function parseAuthEnv(source: EnvSource): AuthEnv {
  return parseEnv(authEnvSchema, source);
}

let authEnv: AuthEnv | undefined;

/** Variables de l'auth, validées au premier accès. */
export function getAuthEnv(): AuthEnv {
  authEnv ??= parseAuthEnv(process.env);
  return authEnv;
}
