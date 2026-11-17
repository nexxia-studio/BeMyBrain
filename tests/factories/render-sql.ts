import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/** Rend une condition Drizzle en SQL paramétré, pour vérifier les filtres explicites d'une requête. */
export function renderSql(condition: unknown): {
  sql: string;
  params: unknown[];
} {
  return new PgDialect().sqlToQuery(condition as SQL);
}
