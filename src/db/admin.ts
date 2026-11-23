import { drizzle } from "drizzle-orm/neon-serverless";

import { getMigrationEnv } from "./migration-env";
import { createPool } from "./pool";

// Rôle propriétaire : contourne la RLS. Réservé aux scripts (migrations, seed).
// Import interdit depuis src/app, src/components et src/modules (eslint.config.mjs).
const pool = createPool(getMigrationEnv().DATABASE_URL, "propriétaire");

export const adminDb = drizzle({ client: pool });
