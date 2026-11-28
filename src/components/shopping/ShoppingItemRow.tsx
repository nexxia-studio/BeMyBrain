"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ligne d'un article de courses : carte claire de la surface « Creux » (DESIGN.md § 5, comme une ligne de la
// liste des tâches). Toute la ligne est la cible du tap (`role="checkbox"`, min-h-11 = 44 px, jamais moins) :
// pastille ronde à gauche, libellé saisi (jamais traduit) à droite. Coché : pastille pleine `primary` et coche,
// libellé barré en texte secondaire sur la carte (6,83:1, pas d'opacité qui ferait tomber le contraste).
// Aucun composant d'animation dans la ligne (le rayon sera glissable, tâche 14 : gotcha) ; retour au toucher en CSS.
// Pas de logique de données : l'appelant coche (`onToggle`) et fournit le message d'échec.
// Emplacement `actions` : le menu de la ligne (tâche 15) vient à droite, hors du bouton (jamais un bouton dans un bouton).
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ShoppingItem } from "@/modules/shopping/list-view";

import { TASK_LIST_ROW_SURFACE_CLASSES } from "../tasks/task-list-layout";

type ShoppingItemRowProps = {
  item: ShoppingItem;
  /** Dernier tap non enregistré : message sous la ligne, l'article est revenu à son état. */
  failed: boolean;
  onToggle: (item: ShoppingItem) => void;
  /** Emplacement du menu de ligne (tâche 15). */
  actions?: React.ReactNode;
};

export function ShoppingItemRow({
  item,
  failed,
  onToggle,
  actions,
}: ShoppingItemRowProps) {
  const t = useTranslations("shopping.list");
  const checked = item.checkedAt !== null;

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg",
        TASK_LIST_ROW_SURFACE_CLASSES,
        "pointer-fine:has-[button:hover]:outline-input",
      )}
    >
      <div className="flex min-h-11 items-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onToggle(item)}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-body break-words",
            checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5.5 shrink-0 items-center justify-center rounded-full border-2",
              checked
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-row",
            )}
          >
            {checked && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          {/* Contenu saisi : jamais traduit. */}
          <span className="min-w-0">{item.label}</span>
        </button>
        {actions}
      </div>
      {failed && (
        <p role="alert" className="px-3.5 pb-2.5 text-caption text-destructive">
          {t("notSaved")}
        </p>
      )}
    </div>
  );
}
