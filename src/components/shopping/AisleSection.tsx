"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Un rayon : creux `pill-track` posé à nu sur la brume (DESIGN.md § 5, comme une section de la liste des
// tâches), en-tête (nom du rayon en surtitre, capitales, et nombre d'articles à acheter) à l'encre, jamais de
// texte secondaire sur le creux ; puis les lignes. Le nom vient de `shopping.aisles.<clé>` (clés stables en code).
import { useTranslations } from "next-intl";

import type { AisleGroup, ShoppingItem } from "@/modules/shopping/list-view";

import {
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "../tasks/task-list-layout";
import { ShoppingItemRow } from "./ShoppingItemRow";

type AisleSectionProps = {
  aisle: AisleGroup;
  /** Identifiants des articles dont le dernier tap n'a pas été enregistré. */
  failedIds: ReadonlySet<string>;
  onToggle: (item: ShoppingItem) => void;
  /** Poignée de glisser du rayon (`AisleSortable`), à droite de l'en-tête ; absente s'il n'y a qu'un rayon. */
  handle?: React.ReactNode;
};

export function AisleSection({
  aisle,
  failedIds,
  onToggle,
  handle,
}: AisleSectionProps) {
  const t = useTranslations("shopping.aisles");
  const headingId = `shopping-aisle-${aisle.aisleKey}`;
  const toBuy = aisle.items.filter((i) => i.checkedAt === null).length;

  return (
    <section aria-labelledby={headingId} className={TASK_SECTION_CLASSES}>
      <div className={TASK_SECTION_HEADER_CLASSES}>
        <h2
          id={headingId}
          className={`${TASK_SECTION_HEADING_TEXT} text-foreground uppercase`}
        >
          {t(aisle.aisleKey)}
        </h2>
        <span
          aria-hidden="true"
          className={`${TASK_SECTION_HEADING_TEXT} font-heading text-foreground`}
        >
          {toBuy}
        </span>
        {handle}
      </div>
      <ul className={TASK_ROWS_CLASSES}>
        {aisle.items.map((item) => (
          <li key={item.id}>
            <ShoppingItemRow
              item={item}
              failed={failedIds.has(item.id)}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
