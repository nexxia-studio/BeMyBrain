// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Givre de chargement (DESIGN.md § 5 « États de chargement — givre ») : composant serveur, CSS pur,
// affiché avant tout JavaScript. Tuile de verre + voile teinté (jamais un second verre) ; la tuile
// pleine « Aujourd'hui » reste vide, sans voile. Le décalage vient de `--frost-index`.
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type FrostTileProps = {
  /** Classes de taille et de position de la vraie tuile (aucun décalage de mise en page). */
  className?: string;
  /** Rang de la tuile : décale son éclaircissement. */
  index?: number;
  variant?: "glass" | "solid";
};

export function FrostTile({
  className,
  index = 0,
  variant = "glass",
}: FrostTileProps) {
  if (variant === "solid") {
    return (
      <div
        aria-hidden="true"
        className={cn("rounded-tile bg-primary shadow-today", className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "glass relative isolate overflow-hidden rounded-tile",
        className,
      )}
      style={{ "--frost-index": index } as CSSProperties}
    >
      <div className="frost pointer-events-none absolute inset-0 -z-1" />
    </div>
  );
}
