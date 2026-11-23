"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Corbeille `/trash` (spec todo-unifiee, « Corbeille (`/trash`) ») : une tuile en verre, lignes `row` dedans
// (jamais de verre sur du verre), tous types mêlés dans l'ordre reçu (`loadTrash` : plus récente d'abord).
// Une colonne à toutes les largeurs (repli sous 768 px sans objet). Vide : « La corbeille est vide ».
// Mouvement (DESIGN.md § 7) : une ligne restaurée (rendu serveur reçu) sort en `opacity` + `y` 8, ressort sans
// rebond, 0,3 s. Rien à l'affichage initial. MotionConfig reducedMotion="user" (coque) coupe le déplacement.
import { Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { TrashItem } from "./trash-item";
import {
  TRASH_LIST_TILE_CLASSES,
  TRASH_ROWS_CLASSES,
} from "./trash-list-layout";
import { TrashRow } from "./TrashRow";

const LEAVE = { opacity: 0, y: 8 };
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type TrashListProps = { items: TrashItem[] };

export function TrashList({ items }: TrashListProps) {
  const t = useTranslations("trash");

  if (items.length === 0) {
    return (
      <section className="glass flex flex-col items-start gap-3 rounded-tile p-tile">
        <span className="flex size-11 items-center justify-center rounded-lg bg-row text-link">
          <Trash2 aria-hidden="true" className="size-5.5" strokeWidth={2} />
        </span>
        <p className="text-body text-foreground">{t("empty")}</p>
      </section>
    );
  }

  return (
    <section className={cn("glass", TRASH_LIST_TILE_CLASSES)}>
      <ul className={TRASH_ROWS_CLASSES}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.key}
              initial={LEAVE}
              animate={{ opacity: 1, y: 0 }}
              exit={LEAVE}
              transition={SPRING}
            >
              <TrashRow item={item} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
