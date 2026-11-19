import { z } from "zod";

import { locales } from "@/i18n/locales";

import { contextColors } from "./context-colors";
import { CoreError } from "./errors";
import { sides } from "./sides";

export { sides, type Side } from "./sides";
export { contextColors, type ContextColor } from "./context-colors";

export const uuidSchema = z.uuid();
export const sideSchema = z.enum(sides);
export const contextColorSchema = z.enum(contextColors);
export const localeSchema = z.enum(locales);
export const contextFilterSchema = z.object({ side: sideSchema });

/** Valide une entrée ; refus → CoreError("invalid_params"), sans la valeur reçue (pas de ZodError masquée par withUserDb). */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new CoreError("invalid_params");
  return result.data;
}
