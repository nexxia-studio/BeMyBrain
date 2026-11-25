"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Planche des teintes de priorité (tâche 11 du plan todo-kanban, DESIGN.md § 2 et § 5) : l'échelle rouge, orangé,
// jaune, vert, validée par Antoine sur iPhone le 2026-11-26 et appliquée partout (tâche 12) ; elle reste jusqu'au
// retrait de la démo, avec le badge de l'app (`PriorityBadge`). Sur chacune des trois surfaces où une priorité se posera
// (carte `popover`, ligne `row` sur le verre, colonne creusée `pill-track`) :
// - l'échelle : le badge d'une carte (carré arrondi, icône seule, libellé pour le lecteur d'écran) à côté d'une
//   pastille d'espace de chaque couleur, puis la pastille du détail (icône et libellé) ;
// - deux voisinages à juger : « Haute » contre la pastille d'espace chaude (orangés proches, séparés par la forme
//   et l'icône), « Urgente » contre une date en retard (rouge en badge, braise en texte sans fond).
// Rien d'interactif, aucun mouvement. Une colonne sous 768 px, trois au-delà.
// Limite : la colonne est ici dans la tuile de verre des réglages ; sur le tableau, elle est posée sur la brume.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { useFormatter, useTranslations } from "next-intl";

import { chipTriggerClass } from "@/components/tasks/chip-styles";
import { contextChipClass } from "@/components/tasks/context-chip-class";
import {
  PRIORITY_ICONS,
  PRIORITY_TINT_CLASSES,
  type PriorityLevel,
} from "@/components/tasks/priority-icons";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { cn } from "@/lib/utils";
import type { ContextColor } from "@/modules/core/context-colors";

import { DEMO_SPACES } from "./demo-fixtures";

const LEVELS: readonly PriorityLevel[] = [1, 2, 3, 4];

const SURFACES = [
  { key: "card", className: "border border-border bg-popover shadow-raised" },
  { key: "row", className: "bg-row" },
  { key: "column", className: "bg-pill-track" },
] as const;

// Date fictive passée, à midi UTC : même jour dans tous les fuseaux.
const OVERDUE = new Date(Date.UTC(2026, 10, 12, 12));

export function KanbanDemoPriorityTints() {
  const t = useTranslations("kanbanDemo.tints");
  const tList = useTranslations("tasks.list");
  const tDetail = useTranslations("tasks.detail.priority");
  const format = useFormatter();

  // Le badge de l'app (`PriorityBadge`), pas un rendu propre à la planche.
  const badge = (level: PriorityLevel) => (
    <PriorityBadge key={level} priority={level} />
  );
  const spaceChip = ([name, color]: readonly [string, ContextColor]) => (
    // Contenu saisi : jamais traduit.
    <span
      key={color}
      data-space-chip={color}
      className={contextChipClass(color)}
    >
      {name}
    </span>
  );

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
            <div
              data-scale=""
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
            >
              {LEVELS.map(badge)}
              {DEMO_SPACES.map(spaceChip)}
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
            <div data-neighbors="high-warm" className="flex flex-col gap-1">
              <span className="text-caption">{t("highWarm")}</span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {badge(2)}
                {DEMO_SPACES.filter(([, color]) => color === "warm").map(
                  spaceChip,
                )}
              </span>
            </div>
            <div
              data-neighbors="urgent-overdue"
              className="flex flex-col gap-1"
            >
              <span className="text-caption">{t("urgentOverdue")}</span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption">
                {badge(1)}
                <span className="text-destructive">
                  <span className="sr-only">{tList("sections.overdue")}</span>
                  {format.dateTime(OVERDUE, { day: "numeric", month: "short" })}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
