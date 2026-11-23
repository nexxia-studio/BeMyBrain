"use client";

// Relevé des hauteurs de tuiles (QA-6 d'effets-de-verre) : après le rendu et à chaque redimensionnement
// (ResizeObserver), mesure la boîte affichée de chaque tuile de la grille (`[data-tile]`, étirement de la rangée
// compris) et écrit le relevé du côté et du palier courants dans le cookie, en gardant les autres. Le givre
// (`dashboard/loading.tsx`) le relit au chargement suivant. N'affiche rien.
// Côté : lu dans le DOM rendu (`data-side` de la grille) au moment de la mesure, jamais gardé dans la fermeture.
// Après une bascule en transition, React pose le nouveau DOM avant de relancer les effets : l'ancien observateur
// peut se déclencher entre les deux et mesurerait les tuiles du nouveau côté sous l'ancien. Une tuile qui
// n'appartient pas au côté lu → rien n'est écrit.
// Palier : `--tile-tier` de `globals.css`, posé par les mêmes requêtes média que la grille (source unique).
// Animations de la grille (révélation, bascule, écrans vides, entrée) : GSAP ne déplace que `y` (translation) et
// l'opacité ; une translation ne change pas la hauteur de `getBoundingClientRect()`, et ResizeObserver ne se
// déclenche pas pour elle : un relevé pris pendant une animation est juste.
import { type RefObject, useEffect } from "react";

import { sides, type Side } from "@/modules/core/sides";
import {
  parseTileTier,
  recordTileHeights,
  TILE_HEIGHTS_COOKIE,
  tileHeightsCookie,
} from "@/modules/dashboard/tile-heights";
import { tileIdsOf } from "@/modules/dashboard/tiles";

type TileHeightRecorderProps = {
  /** Grille dont les enfants directs `[data-tile]` sont relevés ; porte le côté rendu (`data-side`). */
  rootRef: RefObject<HTMLElement | null>;
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

function sideOf(root: HTMLElement): Side | null {
  const side = root.dataset.side;
  return (sides as readonly string[]).includes(side ?? "")
    ? (side as Side)
    : null;
}

export function TileHeightRecorder({ rootRef, path }: TileHeightRecorderProps) {
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
      const side = sideOf(root);
      if (tier === null || side === null) return;
      const known = tileIdsOf(side);
      const measured: Record<string, number> = {};
      for (const tile of tiles()) {
        const id = tile.dataset.tile ?? "";
        // DOM d'un autre côté que celui lu (transition en cours) : relevé incohérent, rien n'est écrit.
        if (!known.includes(id)) return;
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
  }, [rootRef, path]);

  return null;
}
