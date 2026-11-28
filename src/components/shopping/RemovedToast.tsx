"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Bulle « Article supprimé · Annuler » (DESIGN.md § 5, « Bulle d'échec du tableau » : même bulle opaque
// `popover rounded-lg shadow-glass`, fixe au-dessus de la barre d'onglets sur mobile, en bas à droite à partir
// de 1024 px, `z-(--z-toast)`), relevée au-dessus du champ d'ajout collant (`--toast-above-field`, globals.css). Le nom saisi est dans le texte, jamais traduit. « Annuler » : bouton discret
// `text-link`, 44 px. Entrée et sortie : aucune animation (la bulle apparaît et disparaît d'un coup, 5 s).
import { useTranslations } from "next-intl";

import type { ShoppingItem } from "@/modules/shopping/list-view";

type RemovedToastProps = {
  item: ShoppingItem | null;
  onUndo: () => void;
};

export function RemovedToast({ item, onUndo }: RemovedToastProps) {
  const t = useTranslations("shopping.removed");
  return (
    <div className="pointer-events-none fixed inset-x-page bottom-toast-above-field z-(--z-toast) flex justify-center lg:inset-x-auto lg:right-page lg:bottom-toast-above-field-lg">
      {/* Région `status` toujours montée : seul son contenu change, pour que le lecteur d'écran l'annonce. */}
      <div role="status">
        {item !== null && (
          <div
            data-testid="removed-toast"
            className="pointer-events-auto flex max-w-full items-center gap-1 rounded-lg bg-popover pl-4 text-small font-medium text-foreground shadow-glass"
          >
            <span className="min-w-0 py-2 break-words">
              {t("message", { label: item.label })}
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="min-h-11 shrink-0 cursor-pointer rounded-lg px-4 font-semibold text-link focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t("undo")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
