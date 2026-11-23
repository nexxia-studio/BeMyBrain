"use client";

// Relevé des hauteurs de tuiles (QA-6 d'effets-de-verre) : après le rendu et à chaque redimensionnement
// (ResizeObserver), mesure la boîte affichée de chaque tuile de la grille (`[data-tile]`, étirement de la rangée
// compris) et écrit le relevé du côté et du palier courants dans le cookie, en gardant les autres. Le givre
// (`dashboard/loading.tsx`) le relit au chargement suivant. N'affiche rien.
// Palier : `--tile-tier` de `globals.css`, posé par les mêmes requêtes média que la grille (source unique).
// Animations de la grille (révélation, bascule, écrans vides, entrée) : GSAP ne déplace que `y` (translation) et
// l'opacité ; une translation ne change pas la hauteur de `getBoundingClientRect()`, et ResizeObserver ne se
// déclenche pas pour elle : un relevé pris pendant une animation est juste.
import { type RefObject, useEffect } from "react";

import type { Side } from "@/modules/core/sides";
import {
  parseTileTier,
  recordTileHeights,
  TILE_HEIGHTS_COOKIE,
  tileHeightsCookie,
} from "@/modules/dashboard/tile-heights";

type TileHeightRecorderProps = {
  /** Grille dont les enfants directs `[data-tile]` sont relevés. */
  rootRef: RefObject<HTMLElement | null>;
  /** Côté affiché, lu dans le cookie par le serveur. */
  side: Side;
  /** Chemin du cookie : celui de la route du tableau de bord, passé par la page. */
  path: string;
};

function currentCookie(): string | undefined {
  const prefix = `${TILE_HEIGHTS_COOKIE}=`;
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(prefix))
    ?.slice(prefix.length);
}

export function TileHeightRecorder({
  rootRef,
  side,
  path,
}: TileHeightRecorderProps) {
  useEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof ResizeObserver !== "function") return;
    const tiles = () =>
      Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-tile]"));

    const record = () => {
      const tier = parseTileTier(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--tile-tier",
        ),
      );
      if (tier === null) return;
      const measured: Record<string, number> = {};
      for (const tile of tiles()) {
        const id = tile.dataset.tile;
        if (id !== undefined)
          measured[id] = tile.getBoundingClientRect().height;
      }
      const previous = currentCookie();
      const value = recordTileHeights(previous, side, tier, measured);
      if (value !== null && value !== previous) {
        document.cookie = tileHeightsCookie(value, path);
      }
    };

    const observer = new ResizeObserver(record);
    observer.observe(root);
    for (const tile of tiles()) observer.observe(tile);
    record();
    return () => observer.disconnect();
  }, [rootRef, side, path]);

  return null;
}
