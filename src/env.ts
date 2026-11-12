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
