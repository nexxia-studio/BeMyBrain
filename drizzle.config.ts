import { defineConfig } from "drizzle-kit";

import {
  parseMigrationEnv,
  selectMigrationTarget,
} from "./src/db/migration-env";
import { assertNotProductionTarget } from "./src/db/production-guard";
import { loadEnvFileIfPresent } from "./src/lib/load-env-file";

loadEnvFileIfPresent();
// Branche visée : DATABASE_URL, ou la branche test si MIGRATION_TARGET=test (pnpm db:migrate:test).
const env = selectMigrationTarget(process.env);
// En local, refuse toute commande drizzle-kit dont la cible est la branche production.
assertNotProductionTarget(env);

// Rôle propriétaire : seul rôle autorisé à migrer. Même commande partout (ADR-005).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*",
  out: "./drizzle",
  dbCredentials: { url: parseMigrationEnv(env).DATABASE_URL },
  strict: true,
  verbose: true,
});
