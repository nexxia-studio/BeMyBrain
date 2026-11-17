import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { getMigrationEnv } from "./migration-env";

// Rôle propriétaire : contourne la RLS. Réservé aux scripts (migrations, seed).
// Import interdit depuis src/app, src/components et src/modules (eslint.config.mjs).
const pool = new Pool({ connectionString: getMigrationEnv().DATABASE_URL });
// Message générique : ni URL ni détail de l'erreur du pilote.
pool.on("error", () => {
  console.error("Erreur sur une connexion inactive du pool propriétaire.");
});

export const adminDb = drizzle({ client: pool });
