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

/**
 * Choisit la branche à migrer. Par défaut : celle de DATABASE_URL (dev en local, la cible fixée par la CI ailleurs).
 * `MIGRATION_TARGET=test` (script `db:migrate:test`) : branche test, via DATABASE_TEST_URL et
 * DATABASE_TEST_AUTHENTICATED_URL. Remplacement explicite après chargement de `.env`, car
 * `process.loadEnvFile` ne remplace jamais une variable déjà définie. Retourne une copie.
 */
export function selectMigrationTarget(source: EnvSource): EnvSource {
  const target = source.MIGRATION_TARGET;
  if (target === undefined || target === "") return { ...source };
  if (target !== "test") {
    throw new Error(
      "MIGRATION_TARGET inconnue : seule la valeur « test » est acceptée.",
    );
  }
  for (const name of ["DATABASE_TEST_URL", "DATABASE_TEST_AUTHENTICATED_URL"]) {
    if (!source[name]) {
      throw new Error(
        `MIGRATION_TARGET=test exige ${name}. Voir .env.example.`,
      );
    }
  }
  return {
    ...source,
    DATABASE_URL: source.DATABASE_TEST_URL,
    DATABASE_AUTHENTICATED_URL: source.DATABASE_TEST_AUTHENTICATED_URL,
  };
}

/** Variables des migrations et du seed. Jamais appelé par l'app. */
export function getMigrationEnv(): MigrationEnv {
  return parseMigrationEnv(process.env);
}
