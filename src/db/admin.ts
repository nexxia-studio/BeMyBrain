import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { getMigrationEnv } from "@/env";

// Rôle propriétaire : contourne la RLS. Réservé aux scripts (migrations, seed).
// Import interdit depuis src/app, src/components et src/modules (eslint.config.mjs).
export const adminDb = drizzle({
  client: new Pool({ connectionString: getMigrationEnv().DATABASE_URL }),
});
