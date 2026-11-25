"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Planche de validation des teintes de priorité (tâche 11 du plan todo-kanban, DESIGN.md § 2 et § 5) : Antoine
// juge les quatre teintes à l'œil avant leur application partout (tâche 12). Les cartes et le détail de la démo
// restent à l'encre, pour comparer. Sur chacune des trois surfaces où une priorité se posera (carte `popover`,
// ligne `row` sur le verre, colonne creusée `pill-track`) : le badge d'une carte (icône seule sur son fond teinté,
// libellé pour le lecteur d'écran) à côté d'une pastille d'espace de chaque couleur, puis la pastille du détail
// (icône et libellé). Rien d'interactif, aucun mouvement. Une colonne sous 768 px, trois au-delà.
// Limite : la colonne est ici dans la tuile de verre des réglages ; sur le tableau, elle est posée sur la brume.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { useTranslations } from "next-intl";

import { chipTriggerClass } from "@/components/tasks/chip-styles";
import { contextChipClass } from "@/components/tasks/context-chip-class";
import {
  PRIORITY_ICONS,
  PRIORITY_TINT_CLASSES,
  type PriorityLevel,
} from "@/components/tasks/priority-icons";
import { cn } from "@/lib/utils";

import { DEMO_SPACES } from "./demo-fixtures";

const LEVELS: readonly PriorityLevel[] = [1, 2, 3, 4];

const SURFACES = [
  { key: "card", className: "border border-border bg-popover shadow-raised" },
  { key: "row", className: "bg-row" },
  { key: "column", className: "bg-pill-track" },
] as const;

export function KanbanDemoPriorityTints() {
  const t = useTranslations("kanbanDemo.tints");
  const tList = useTranslations("tasks.list.priority");
  const tDetail = useTranslations("tasks.detail.priority");

  return (
    <div className="flex flex-col gap-1.5 md:basis-full">
      <span className="text-small font-medium">{t("title")}</span>
      <div className="grid gap-2 md:grid-cols-3">
        {SURFACES.map((surface) => (
          <div
            key={surface.key}
            role="group"
            aria-label={t(surface.key)}
            className={cn(
              "flex flex-col gap-2.5 rounded-lg p-3",
              surface.className,
            )}
          >
            {/* À l'encre : jamais de texte secondaire sur la colonne creusée. */}
            <span aria-hidden="true" className="text-caption font-medium">
              {t(surface.key)}
            </span>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              {LEVELS.map((level) => {
                const Icon = PRIORITY_ICONS[level];
                return (
                  <span
                    key={level}
                    className={cn(
                      "flex items-center rounded-full px-2 py-0.5",
                      PRIORITY_TINT_CLASSES[level],
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={2}
                    />
                    <span className="sr-only">{tList(`${level}`)}</span>
                  </span>
                );
              })}
              {DEMO_SPACES.map(([name, color]) => (
                // Contenu saisi : jamais traduit.
                <span
                  key={color}
                  data-space-chip={color}
                  className={contextChipClass(color)}
                >
                  {name}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LEVELS.map((level) => {
                const Icon = PRIORITY_ICONS[level];
                return (
                  <span
                    key={level}
                    className={cn(
                      chipTriggerClass,
                      PRIORITY_TINT_CLASSES[level],
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                      strokeWidth={2}
                    />
                    <span>{tDetail(`${level}`)}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
