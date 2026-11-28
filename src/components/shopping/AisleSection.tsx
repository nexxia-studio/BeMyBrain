"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Un rayon : creux `pill-track` posé à nu sur la brume (DESIGN.md § 5, comme une section de la liste des
// tâches), en-tête (nom du rayon en surtitre, capitales, et nombre d'articles à acheter) à l'encre, jamais de
// texte secondaire sur le creux ; puis les lignes. Compteur lisible (« 3 à acheter »). Tout coché : rayon replié
// (bouton d'en-tête, `aria-expanded`). Déplacement des lignes (réordonnancement différé) : `useFlipList`, porté par le `<li>`. Le nom vient de `shopping.aisles.<clé>` (clés stables en code).
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { AisleGroup, ShoppingItem } from "@/modules/shopping/list-view";

import {
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "../tasks/task-list-layout";
import { useFlipList } from "./use-flip-list";
import { ItemMenu } from "./ItemMenu";
import { ShoppingItemRow } from "./ShoppingItemRow";

type AisleSectionProps = {
  aisle: AisleGroup;
  /** Identifiants des articles dont le dernier tap n'a pas été enregistré. */
  failedIds: ReadonlySet<string>;
  savingIds: ReadonlySet<string>;
  onToggle: (item: ShoppingItem) => void;
  /** Suppression demandée depuis le menu de la ligne (« Annuler » 5 s, géré par l'écran). */
  onRemove: (item: ShoppingItem) => void;
  /** Poignée de glisser du rayon (`AisleSortable`), à droite de l'en-tête ; absente s'il n'y a qu'un rayon. */
  handle?: React.ReactNode;
};

export function AisleSection({
  aisle,
  failedIds,
  savingIds,
  onToggle,
  onRemove,
  handle,
}: AisleSectionProps) {
  const t = useTranslations("shopping.aisles");
  const tList = useTranslations("shopping.list");
  // Replié au premier rendu si tout est déjà coché (donnée du rendu serveur) ; ensuite, le tap seul décide.
  const [foldable] = useState(() => aisle.items.every((i) => i.checkedAt));
  const [folded, setFolded] = useState(foldable);
  const rows = useRef<HTMLUListElement>(null);
  const headingId = `shopping-aisle-${aisle.aisleKey}`;
  const toBuy = aisle.items.filter((i) => i.checkedAt === null).length;
  // Un article ajouté dans un rayon replié le déplie (il ne reste pas caché).
  const collapsed = folded && toBuy === 0;
  useFlipList(rows);
  const rowsId = `${headingId}-rows`;
  const name = t(aisle.aisleKey);
  const headingClasses = `${TASK_SECTION_HEADING_TEXT} text-foreground uppercase`;

  return (
    <section aria-labelledby={headingId} className={TASK_SECTION_CLASSES}>
      <div className={TASK_SECTION_HEADER_CLASSES}>
        <h2 id={headingId} className={`${headingClasses} min-w-0 flex-1`}>
          {foldable ? (
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-controls={rowsId}
              onClick={() => setFolded(!collapsed)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-left uppercase"
            >
              {name}
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 ${collapsed ? "-rotate-90" : ""}`}
              />
            </button>
          ) : (
            name
          )}
        </h2>
        <span className={`${TASK_SECTION_HEADING_TEXT} text-foreground`}>
          {collapsed
            ? tList("aisleAllChecked")
            : tList("aisleToBuy", { count: toBuy })}
        </span>
        {handle}
      </div>
      <ul
        id={rowsId}
        ref={rows}
        hidden={collapsed}
        className={collapsed ? "hidden" : TASK_ROWS_CLASSES}
      >
        {aisle.items.map((item) => (
          <li key={item.id} data-flip-id={item.id}>
            <ShoppingItemRow
              item={item}
              failed={failedIds.has(item.id)}
              saving={savingIds.has(item.id)}
              onToggle={onToggle}
              actions={<ItemMenu item={item} onRemove={onRemove} />}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
