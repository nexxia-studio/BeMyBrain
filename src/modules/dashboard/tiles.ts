import type { Side } from "@/modules/core/schemas";

// Tuiles du tableau de bord (BRAIN-7) : règle d'affichage pure, sans React, sans Next, sans base
// (ADR-008). Les espaces viennent de la base (src/modules/core), la sélection du filtre d'espace.
// Une tuile est typée par côté (elle n'existe que d'un côté) et par espace (elle couvre les espaces
// retenus par le filtre de ce côté). Aucun module métier n'existe encore : toutes les tuiles sont vides.
// raccourci: catalogue fixe tiré de la feuille de route — chaque module remplacera sa tuile vide à sa
// feature, et le catalogue deviendra configurable avec les espaces personnalisables (BRAIN-30).

/** Base de largeur dans la grille bento (DESIGN.md § 6) : large, standard ou chiffre. */
export type TileSize = "wide" | "standard" | "figure";

// `mixesSpaces` : la tuile mêle les éléments de plusieurs espaces (la To-do, une pastille par ligne dans
// la référence) ; elle les nomme quand le côté en a plusieurs. Les autres se lisent par le filtre seul.
const CATALOG = [
  { id: "privateTodo", side: "private", size: "wide", mixesSpaces: true },
  // La paire de tuiles chiffre, seule à partager une rangée sur mobile (DESIGN.md § 8, décision 9).
  { id: "shopping", side: "private", size: "figure", mixesSpaces: false },
  { id: "budget", side: "private", size: "figure", mixesSpaces: false },
  { id: "health", side: "private", size: "standard", mixesSpaces: false },
  { id: "home", side: "private", size: "standard", mixesSpaces: false },
  { id: "proTodo", side: "pro", size: "wide", mixesSpaces: true },
  { id: "clients", side: "pro", size: "standard", mixesSpaces: false },
  { id: "proFinances", side: "pro", size: "standard", mixesSpaces: false },
  { id: "social", side: "pro", size: "standard", mixesSpaces: false },
] as const satisfies readonly {
  id: string;
  side: Side;
  size: TileSize;
  mixesSpaces: boolean;
}[];

export type TileId = (typeof CATALOG)[number]["id"];

export type DashboardTile = {
  id: TileId;
  side: Side;
  size: TileSize;
  /** Espaces couverts, retenus par le filtre, dans l'ordre du workspace (noms saisis, jamais traduits). */
  spaces: string[];
  /**
   * Espaces à nommer sur la tuile : ceux qu'elle couvre si elle les mêle et que le côté en a plusieurs ;
   * sinon vide (rien à distinguer).
   */
  spaceLabels: string[];
};

export type Dashboard = {
  side: Side;
  /** Espaces retenus du côté actif, dans l'ordre du workspace. */
  spaces: string[];
  tiles: DashboardTile[];
};

type Space = { id: string; name: string };

/**
 * Tuiles du côté actif, restreintes aux espaces retenus par le filtre. Sélection qui ne désigne aucun
 * espace du côté → tous les espaces (même repli que le cookie du filtre). Côté sans espace → aucune
 * tuile (rien ne peut y être classé).
 */
export function buildDashboard(input: {
  side: Side;
  /** Espaces du côté actif, dans l'ordre du workspace. */
  contexts: readonly Space[];
  /** Identifiants retenus par le filtre d'espace. */
  selected: readonly string[];
}): Dashboard {
  const { side, contexts, selected } = input;
  if (contexts.length === 0) return { side, spaces: [], tiles: [] };

  const wanted = new Set(selected);
  const retained = contexts.filter((context) => wanted.has(context.id));
  const spaces = (retained.length > 0 ? retained : contexts).map(
    (context) => context.name,
  );
  const distinguishable = contexts.length >= 2;

  return {
    side,
    spaces,
    tiles: CATALOG.filter((tile) => tile.side === side).map((tile) => ({
      id: tile.id,
      side: tile.side,
      size: tile.size,
      spaces,
      spaceLabels: tile.mixesSpaces && distinguishable ? spaces : [],
    })),
  };
}
