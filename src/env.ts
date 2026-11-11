import { z } from "zod";

// Imports relatifs : ce fichier est aussi chargé par drizzle.config.ts, hors alias tsconfig.
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
export type EnvSource = Record<string, string | undefined>;

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: EnvSource,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  // Seuls le nom de la variable et la nature du problème sortent : jamais la valeur.
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    const reason =
      issue.code === "invalid_type" ? "manquante" : "format invalide";
    return `${name} (${reason})`;
  });
  throw new Error(
    `Variables d'environnement invalides : ${problems.join(", ")}. Voir .env.example.`,
  );
}

export function parseAppEnv(source: EnvSource): AppEnv {
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
