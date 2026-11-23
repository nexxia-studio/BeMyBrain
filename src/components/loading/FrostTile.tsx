// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Givre de chargement (DESIGN.md § 5 « États de chargement — givre ») : composant serveur, CSS pur,
// affiché avant tout JavaScript. Tuile de verre + voile teinté (jamais un second verre) ; la tuile pleine
// « Aujourd'hui » reste sans voile et peut porter une cale de hauteur (enfants), comme les autres. Le décalage
// vient de `--frost-index`. Variante `row` : ligne d'une liste (surface `row` donnée par la classe, posée dans une tuile de verre), voile compris. Les enfants
// (cales de hauteur des listes) sont posés après le voile, au-dessus de lui. Tant qu'un voile est affiché, le
// document n'ancre pas son défilement (`html:has(.frost)`, globals.css) : le haut de page ne saute pas.
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FrostTileProps = {
  /** Classes de taille et de position de la vraie tuile (aucun décalage de mise en page). */
  className?: string;
  /** Rang de la tuile : décale son éclaircissement. */
  index?: number;
  /** `glass` : tuile de verre ; `row` : ligne d'une liste (surface dans `className`) ; `solid` : tuile pleine. */
  variant?: "glass" | "row" | "solid";
  /** Cales de hauteur, posées au-dessus du voile. */
  children?: ReactNode;
  /** Variables CSS ajoutées (hauteurs relevées du tableau de bord, `--tile-h-*`). */
  vars?: Partial<Record<`--${string}`, string>>;
  testId?: string;
};

export function FrostTile({
  className,
  index = 0,
  variant = "glass",
  children,
  testId,
  vars,
}: FrostTileProps) {
  if (variant === "solid") {
    return (
      <div
        aria-hidden="true"
        data-testid={testId}
        className={cn("rounded-tile bg-primary shadow-today", className)}
        style={vars as CSSProperties}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className={cn(
        "relative isolate overflow-hidden",
        variant === "glass" && "glass rounded-tile",
        className,
      )}
      style={{ ...vars, "--frost-index": index } as CSSProperties}
    >
      <div className="frost pointer-events-none absolute inset-0 -z-1" />
      {children}
    </div>
  );
}
