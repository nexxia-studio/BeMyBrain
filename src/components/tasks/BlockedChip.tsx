// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille « Bloquée » d'une légende de tâche (spec todo-kanban, « Relations ») : forme des pastilles, bordée
// `input` (≥ 3:1), texte encre, icône Lucide ; aucune couleur d'espace, la braise reste au retard.
import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { CHIP_SHAPE_CLASSES } from "./context-chip-class";

export function BlockedChip() {
  const t = useTranslations("tasks");

  return (
    <span
      className={cn(
        CHIP_SHAPE_CLASSES,
        "flex items-center gap-1 border border-input text-foreground",
      )}
    >
      <Ban aria-hidden="true" className="size-3.5" strokeWidth={2} />
      {t("blocked")}
    </span>
  );
}
