import { z } from "zod";

import { parseEnv, type EnvSource } from "./parse-env";
import { assertSameHost } from "./production-guard";

// Variables réservées aux migrations et au seed (rôle propriétaire).
// Hors de @/env : l'app n'a aucun chemin vers l'URL propriétaire (frontière eslint).
const migrationEnvSchema = z.object({
  DATABASE_URL: z.url(),
});

export type MigrationEnv = z.infer<typeof migrationEnvSchema>;

export function parseMigrationEnv(source: EnvSource): MigrationEnv {
  const env = parseEnv(migrationEnvSchema, source);
  assertSameHost(source, "DATABASE_URL", "DATABASE_AUTHENTICATED_URL");
  return env;
}

/** Variables des migrations et du seed. Jamais appelé par l'app. */
export function getMigrationEnv(): MigrationEnv {
  return parseMigrationEnv(process.env);
}
