import { z } from "zod";

import { locales } from "@/i18n/locales";

import { CoreError } from "./errors";

export const sides = ["private", "pro"] as const;
export type Side = (typeof sides)[number];

export const uuidSchema = z.uuid();
export const sideSchema = z.enum(sides);
export const localeSchema = z.enum(locales);
export const contextFilterSchema = z.object({ side: sideSchema });

/** Valide une entrée ; refus → CoreError("invalid_input"), sans la valeur reçue (pas de ZodError masquée par withUserDb). */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new CoreError("invalid_input");
  return result.data;
}
