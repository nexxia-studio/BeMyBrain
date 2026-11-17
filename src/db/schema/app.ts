import { pgSchema } from "drizzle-orm/pg-core";

// Schéma des objets propres à l'app (fonctions d'appartenance, tâche 6), séparé de public et neon_auth.
export const app = pgSchema("app");
