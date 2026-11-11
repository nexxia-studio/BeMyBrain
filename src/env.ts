import { z } from "zod";

// Variables lues par l'app au runtime. L'URL propriétaire (DATABASE_URL) n'y figure pas :
// l'app ne parle à la base qu'avec le rôle restreint app_backend (ADR-002).
const appEnvSchema = z.object({
  DATABASE_AUTHENTICATED_URL: z.url(),
  NEON_AUTH_BASE_URL: z.url(),
  NEON_AUTH_JWKS_URL: z.url(),
});

// Variables réservées aux migrations et au seed (rôle propriétaire).
const migrationEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

export type AppEnv = z.infer<typeof appEnvSchema>;
export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

type Source = Record<string, string | undefined>;

function parse<T extends z.ZodType>(schema: T, source: Source): z.infer<T> {
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

export function parseAppEnv(source: Source): AppEnv {
  return parse(appEnvSchema, source);
}

export function parseMigrationEnv(source: Source): MigrationEnv {
  return parse(migrationEnvSchema, source);
}

let appEnv: AppEnv | undefined;

/** Variables de l'app, validées au premier accès. */
export function getAppEnv(): AppEnv {
  appEnv ??= parseAppEnv(process.env);
  return appEnv;
}

/** Variables des migrations et du seed. Jamais appelé par l'app. */
export function getMigrationEnv(): MigrationEnv {
  return parseMigrationEnv(process.env);
}
