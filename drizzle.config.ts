import { defineConfig } from "drizzle-kit";

import { getMigrationEnv } from "./src/env";
import { loadEnvFileIfPresent } from "./src/lib/load-env-file";

loadEnvFileIfPresent();

// Rôle propriétaire : seul rôle autorisé à migrer. Même commande partout (ADR-005).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*",
  out: "./drizzle",
  dbCredentials: { url: getMigrationEnv().DATABASE_URL },
  strict: true,
  verbose: true,
});
