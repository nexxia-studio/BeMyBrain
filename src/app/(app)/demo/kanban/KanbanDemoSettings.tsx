"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Réglages de la démo du kanban, dans une tuile de verre : repliés sous « Réglages » (le tableau reste visible
// sans défiler sur iPhone), puis le sélecteur « Cartes » (D7, visible sans déplier : on compare en glissant), puis
// la ligne d'état de l'enregistrement, toujours visible (`role="status"`, sur le verre : jamais de texte secondaire
// sur le cœur d'un halo). Une colonne sous 768 px, réglages côte à côte au-delà.
// Le sélecteur « Détail » (D9) n'est pas ici : il est dans la fenêtre du détail (`KanbanDemoDetail`), pour comparer
// sur place.
// Mise en page (par la largeur) et délai d'appui (250 ms) fixés après l'essai iPhone : plus de réglage.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { DemoLook } from "./demo-looks";
import { DemoChoiceGroup } from "./DemoChoiceGroup";

export const LATENCIES = [0, 1000, 3000] as const;
export type Latency = (typeof LATENCIES)[number];

type KanbanDemoSettingsProps = {
  latency: Latency;
  onLatencyChange: (latency: Latency) => void;
  failNext: boolean;
  onFailNextChange: (failNext: boolean) => void;
  look: DemoLook;
  onLookChange: (look: DemoLook) => void;
  /** Déplacements en attente d'enregistrement. */
  pendingCount: number;
};

export function KanbanDemoSettings({
  latency,
  onLatencyChange,
  failNext,
  onFailNextChange,
  look,
  onLookChange,
  pendingCount,
}: KanbanDemoSettingsProps) {
  const t = useTranslations("kanbanDemo");

  return (
    <section className="glass flex flex-col gap-1 rounded-tile px-tile py-2">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-body font-semibold [&::-webkit-details-marker]:hidden">
          {t("settings.label")}
          <ChevronDown
            aria-hidden="true"
            className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            strokeWidth={2}
          />
        </summary>
        <div className="flex flex-col gap-4 pt-2 pb-3 md:flex-row md:flex-wrap md:gap-x-8">
          <DemoChoiceGroup
            label={t("settings.latency")}
            value={latency}
            onChange={onLatencyChange}
            options={[
              { value: 0, label: t("settings.latencyNone") },
              { value: 1000, label: t("settings.latencyOne") },
              { value: 3000, label: t("settings.latencyThree") },
            ]}
          />
          {/* Interrupteur : motif de « Terminées » (DESIGN.md § 5), posé sur la piste plutôt que sur un second verre. */}
          <motion.button
            type="button"
            role="switch"
            aria-checked={failNext}
            onClick={() => onFailNextChange(!failNext)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="flex min-h-11 items-center gap-2.5 self-start rounded-full bg-pill-track pr-3 pl-4 text-small font-semibold text-foreground md:self-end"
          >
            {t("settings.failNext")}
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-9 shrink-0 items-center rounded-full",
                failNext
                  ? "bg-primary p-0.5"
                  : "border border-input bg-pill-track p-px",
              )}
            >
              <span
                className={cn(
                  "size-4 rounded-full bg-popover shadow-raised",
                  failNext && "translate-x-4",
                )}
              />
            </span>
          </motion.button>
        </div>
      </details>
      <DemoChoiceGroup
        label={t("settings.look")}
        value={look}
        onChange={onLookChange}
        options={[
          { value: "well", label: t("settings.lookWell") },
          { value: "glass", label: t("settings.lookGlass") },
        ]}
      />
      <p role="status" className="pb-1 text-caption text-muted-foreground">
        {pendingCount > 0 ? t("saving", { count: pendingCount }) : t("saved")}
      </p>
    </section>
  );
}
