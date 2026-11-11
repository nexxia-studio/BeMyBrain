import { defineConfig } from "drizzle-kit";

import { getMigrationEnv } from "./src/db/migration-env";
import { assertNotProductionTarget } from "./src/db/production-guard";
import { loadEnvFileIfPresent } from "./src/lib/load-env-file";

loadEnvFileIfPresent();
// En local, refuse toute commande drizzle-kit dont DATABASE_URL vise la branche production.
assertNotProductionTarget(process.env);

// Rôle propriétaire : seul rôle autorisé à migrer. Même commande partout (ADR-005).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*",
  out: "./drizzle",
  dbCredentials: { url: getMigrationEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
