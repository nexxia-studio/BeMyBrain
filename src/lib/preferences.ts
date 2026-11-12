import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { sideSchema, type Side } from "@/modules/core/schemas";

// Préférences d'affichage (plan socle, décision « Choix Privé / Pro ») : cookies lus côté serveur,
// jamais une donnée métier. Toute valeur inattendue retombe sur un défaut sûr, sans erreur.

export const SIDE_COOKIE = "bmb_side";
export const CONTEXTS_COOKIE = "bmb_contexts";

const DEFAULT_SIDE: Side = "private";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Bien au-delà du nombre de contextes d'un workspace ; borne la taille du cookie.
const MAX_SELECTED_CONTEXTS = 20;

const contextIdsSchema = z.array(z.uuid()).min(1).max(MAX_SELECTED_CONTEXTS);

export const PREFERENCE_COOKIE_OPTIONS = {
  // Lus par le serveur seulement.
  httpOnly: true,
  // WebKit refuse un cookie Secure sur http://localhost (gotcha e2e) : Secure en production.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
} as const;

/** Côté affiché ; absent ou inconnu → Privé. */
export function parseSide(raw: string | undefined): Side {
  const result = sideSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_SIDE;
}

/**
 * Contextes retenus par le filtre, dans l'ordre de `available` (contextes du côté, lus en base).
 * Les identifiants inconnus du workspace sont ignorés ; sélection vide → tous.
 */
export function parseContextSelection(
  raw: string | undefined,
  available: readonly string[],
): string[] {
  const wanted = new Set(raw?.split(",") ?? []);
  const selected = available.filter((id) => wanted.has(id));
  return selected.length > 0 ? selected : [...available];
}

/** Valeur du cookie bmb_contexts, ou null si la sélection est mal formée. */
export function serializeContextSelection(ids: unknown): string | null {
  const result = contextIdsSchema.safeParse(ids);
  return result.success ? [...new Set(result.data)].join(",") : null;
}

export async function readSide(): Promise<Side> {
  return parseSide((await cookies()).get(SIDE_COOKIE)?.value);
}

export async function readContextSelection(
  available: readonly string[],
): Promise<string[]> {
  return parseContextSelection(
    (await cookies()).get(CONTEXTS_COOKIE)?.value,
    available,
  );
}
