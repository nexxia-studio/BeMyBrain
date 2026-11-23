import { HOME_PATH } from "@/lib/auth/routes";
import { sides, type Side } from "@/modules/core/sides";

import { tileIdsOf } from "./tiles";

// Hauteurs mémorisées des tuiles du tableau de bord (QA-6 d'effets-de-verre, décision d'Antoine du 2026-11-23) :
// après chaque affichage, le navigateur relève la hauteur de chaque tuile (TileHeightRecorder) ; au chargement
// suivant, le givre (`dashboard/loading.tsx`) réserve ces hauteurs, lues par le serveur. Un relevé par côté et par
// palier d'écran. Le filtre d'espace n'est pas une clé : il est persistant, le dernier relevé correspond donc au
// filtre courant (un autre filtre relève de la limite « données changées » de la spec).
// Module pur, sans zod (importé par un composant client, docs/gotchas.md), seul point de lecture du cookie.
//
// Le cookie est une donnée non fiable : rien n'en sort qui ne soit un identifiant de tuile connu du côté et un
// entier borné ; aucune chaîne du cookie n'est recopiée dans un style (les longueurs sont reformées ici).
//
// Format compact, caractères permis dans une valeur de cookie sans encodage :
//   segments séparés par `~`, un par côté et palier : `<côté>.<palier>:<entrées>` ;
//   entrées séparées par `_` : `<tuile>-<hauteur>`, hauteur en centièmes de pixel (entier).
//   ex. `private.sm:today-31240_privateTodo-48000~pro.lg:today-28000`
// Centièmes plutôt que pixels entiers : une hauteur de tuile est fractionnaire (lignes de texte à 20,3 px) ;
// arrondie au pixel, l'écart s'ajouterait de rangée en rangée et le contenu bougerait à l'arrivée.

export const TILE_HEIGHTS_COOKIE = "bmb-dashboard-tiles";

/** Paliers d'écran de la grille : leurs seuils sont dans `globals.css` (`--tile-tier`), jamais recopiés ici. */
export const TILE_TIERS = ["sm", "md", "lg"] as const;
export type TileTier = (typeof TILE_TIERS)[number];

/** Au-delà, le cookie est ignoré en entier (deux côtés × trois paliers × toutes les tuiles ≈ 550 caractères). */
export const TILE_HEIGHTS_MAX_LENGTH = 1024;

/** Bornes d'une hauteur, en centièmes de pixel : 80 px à 1 200 px. */
const MIN_HUNDREDTHS = 80_00;
const MAX_HUNDREDTHS = 1200_00;
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

const ENTRY = /^([A-Za-z]{1,20})-([1-9][0-9]{0,5})$/;

/** Hauteurs en centièmes de pixel, par côté, palier et tuile. */
export type TileHeights = Partial<
  Record<Side, Partial<Record<TileTier, Record<string, number>>>>
>;

function isSide(value: string): value is Side {
  return (sides as readonly string[]).includes(value);
}

/** Palier lu dans `--tile-tier` (globals.css) ; toute autre valeur → null. */
export function parseTileTier(raw: string): TileTier | null {
  const tier = raw.trim();
  return (TILE_TIERS as readonly string[]).includes(tier)
    ? (tier as TileTier)
    : null;
}

function inBounds(hundredths: number): boolean {
  return (
    Number.isInteger(hundredths) &&
    hundredths >= MIN_HUNDREDTHS &&
    hundredths <= MAX_HUNDREDTHS
  );
}

function parseEntries(raw: string, side: Side): Record<string, number> {
  const known = tileIdsOf(side);
  const entries: Record<string, number> = {};
  for (const entry of raw.split("_")) {
    const match = ENTRY.exec(entry);
    if (match === null) continue;
    const [, id, digits] = match;
    const hundredths = Number(digits);
    if (known.includes(id) && inBounds(hundredths)) entries[id] = hundredths;
  }
  return entries;
}

/** Relevés lus dans le cookie ; tout ce qui n'est pas reconnu est ignoré, sans erreur. */
export function parseTileHeights(raw: string | undefined): TileHeights {
  const heights: TileHeights = {};
  if (raw === undefined || raw.length > TILE_HEIGHTS_MAX_LENGTH) return heights;
  for (const segment of raw.split("~")) {
    const colon = segment.indexOf(":");
    if (colon === -1) continue;
    const [side, tierRaw, ...rest] = segment.slice(0, colon).split(".");
    const tier = parseTileTier(tierRaw ?? "");
    if (rest.length > 0 || !isSide(side) || tier !== tierRaw || tier === null)
      continue;
    const entries = parseEntries(segment.slice(colon + 1), side);
    if (Object.keys(entries).length === 0) continue;
    heights[side] = {
      ...heights[side],
      [tier]: { ...heights[side]?.[tier], ...entries },
    };
  }
  return heights;
}

function serializeTileHeights(heights: TileHeights): string {
  const segments: string[] = [];
  for (const side of sides) {
    for (const tier of TILE_TIERS) {
      const entries = Object.entries(heights[side]?.[tier] ?? {});
      if (entries.length === 0) continue;
      segments.push(
        `${side}.${tier}:${entries.map(([id, h]) => `${id}-${h}`).join("_")}`,
      );
    }
  }
  return segments.join("~");
}

/**
 * Nouvelle valeur du cookie : le relevé du côté et du palier courants remplace l'ancien, les autres sont gardés
 * (revalidés). Hauteurs mesurées en pixels ; tuile inconnue du côté ou hauteur hors bornes ignorée. Rien de
 * valide, ou valeur trop longue → null (ne rien écrire).
 */
export function recordTileHeights(
  previous: string | undefined,
  side: Side,
  tier: TileTier,
  measuredPx: Record<string, number>,
): string | null {
  const known = tileIdsOf(side);
  const entries: Record<string, number> = {};
  for (const [id, px] of Object.entries(measuredPx)) {
    const hundredths = Math.round(px * 100);
    if (known.includes(id) && inBounds(hundredths)) entries[id] = hundredths;
  }
  if (Object.keys(entries).length === 0) return null;

  const heights = parseTileHeights(previous);
  heights[side] = { ...heights[side], [tier]: entries };
  const value = serializeTileHeights(heights);
  return value.length > TILE_HEIGHTS_MAX_LENGTH ? null : value;
}

/** Variables CSS de hauteur d'une tuile givrée, une par palier relevé (`--tile-h-sm` …), lues par `.tile-reserve`. */
export function tileHeightVars(
  heights: TileHeights,
  side: Side,
  tileId: string,
): Partial<Record<`--tile-h-${TileTier}`, string>> {
  const vars: Partial<Record<`--tile-h-${TileTier}`, string>> = {};
  for (const tier of TILE_TIERS) {
    const hundredths = heights[side]?.[tier]?.[tileId];
    if (hundredths !== undefined && inBounds(hundredths)) {
      vars[`--tile-h-${tier}`] = `${hundredths / 100}px`;
    }
  }
  return vars;
}

/**
 * Chaîne à affecter à `document.cookie`. Sans HttpOnly : écrit par le navigateur. Chemin fixe, celui du tableau de
 * bord (jamais déduit de l'adresse) : le cookie n'est envoyé qu'aux requêtes de cette route.
 */
export function tileHeightsCookie(value: string): string {
  return [
    `${TILE_HEIGHTS_COOKIE}=${value}`,
    `Path=${HOME_PATH}`,
    `Max-Age=${THIRTY_DAYS_SECONDS}`,
    "SameSite=Strict",
    "Secure",
  ].join("; ");
}
