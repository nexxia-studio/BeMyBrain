"use client";

// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Sélecteur de vue de `/tasks`, Liste ou Tableau (spec todo-kanban, « Sélecteur de vue ») : pilule à deux segments
// du modèle de la bascule Privé / Pro (DESIGN.md § 5), icône Lucide + libellé. Posée sur du verre à toutes les
// largeurs : l'en-tête de page est sur le fond nu, où le texte inactif tombe sous 4,5:1 (DESIGN.md § 8, déc. 6).
// Sous 640 px, les libellés sont masqués à l'œil (`sr-only`, noms accessibles gardés) : la pilule tient à côté du
// titre et du filtre d'espace à 390 px. Préférence d'affichage (frontend.md « États ») : changement instantané,
// `aria-busy` pendant l'enregistrement, échec → retour à la vue enregistrée et message. Geste répété : aucune
// animation de glissement, Motion n'anime que la pression.
import { Kanban, List, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { PreferenceStatus } from "@/components/shell/PreferenceStatus";
import { useOptimisticPreference } from "@/components/shell/use-optimistic-preference";
import { setTasksView } from "@/lib/preferences-actions";
import { tasksViews, type TasksView } from "@/lib/tasks-view";
import { cn } from "@/lib/utils";

const ICON: Record<TasksView, LucideIcon> = { list: List, board: Kanban };

type ViewSwitchProps = {
  /** Vue lue dans le cookie bmb_tasks_view par le serveur. */
  view: TasksView;
};

export function ViewSwitch({ view }: ViewSwitchProps) {
  const t = useTranslations("tasks.view");
  const { shown, pending, failed, update } = useOptimisticPreference(
    view,
    setTasksView,
  );

  function choose(next: TasksView) {
    if (next === shown) return;
    update(next);
  }

  return (
    <div className="glass relative rounded-full">
      <div
        role="group"
        aria-label={t("label")}
        aria-busy={pending}
        className="flex gap-1 rounded-full bg-pill-track p-1"
      >
        {tasksViews.map((value) => {
          const active = value === shown;
          const Icon = ICON[value];
          return (
            <motion.button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(value)}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-small font-semibold sm:px-4",
                active
                  ? "bg-pill-active text-foreground shadow-raised"
                  : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4.5" strokeWidth={2} />
              <span className="max-sm:sr-only">{t(value)}</span>
            </motion.button>
          );
        })}
      </div>
      <PreferenceStatus failed={failed} className="right-0" />
    </div>
  );
}
