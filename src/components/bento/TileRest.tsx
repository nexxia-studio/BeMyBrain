// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// État de remplissage d'une tuile à hauteur fixe peu remplie (DESIGN.md § 6, « Hauteurs fixes ») : sous les
// lignes, il prend toute la place restante et y centre une icône et une phrase (« Rien d'autre aujourd'hui »).
// Jamais du blanc. Même vocabulaire que l'état vide (carré d'icône 44 px, phrase `text-small`) ; sur la tuile
// pleine, carré `on-primary-surface` bordé et phrase `on-primary-lead` (5,51:1 sur l'indigo). Décoratif sauf la
// phrase : l'icône est `aria-hidden`.
import { CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type TileRestProps = {
  /** Phrase traduite. */
  label: string;
  /** Surface de la tuile : verre, ou tuile pleine « Aujourd'hui ». */
  tone: "glass" | "primary";
};

export function TileRest({ label, tone }: TileRestProps) {
  return (
    <div
      data-testid="tile-rest"
      className="flex min-h-0 flex-1 items-center gap-3"
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          tone === "glass"
            ? "bg-row text-link"
            : "border border-on-primary-border bg-on-primary-surface text-primary-foreground",
        )}
      >
        <CircleCheck aria-hidden="true" className="size-5.5" strokeWidth={2} />
      </span>
      <p
        className={cn(
          "min-w-0 text-small",
          tone === "glass" ? "text-muted-foreground" : "text-on-primary-lead",
        )}
      >
        {label}
      </p>
    </div>
  );
}
