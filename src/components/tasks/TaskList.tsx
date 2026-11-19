"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Liste `/tasks` (spec todo-unifiee, « Liste ») : une seule tuile en verre, sections d'échéance dedans (En
// retard, Aujourd'hui, Demain, Plus tard, Sans échéance, puis Terminées si l'interrupteur les montre), titre de
// section en surtitre suivi de son compteur, lignes `row` (jamais de verre sur du verre). Une colonne à toutes
// les largeurs ; sur ordinateur, tuile bornée (`max-w-3xl`) pour que titre et légende restent dans le regard. Règles de sections et d'ordre : `groupBySection`
// (src/modules/tasks/view.ts), pas ici.
// Mouvement (DESIGN.md § 7) : une ligne qui quitte la liste (cochée, rendu serveur reçu) sort en `opacity`
// + `y` 8, ressort sans rebond, 0,3 s ; une section vidée sort de même. Rien à l'affichage initial.
// MotionConfig reducedMotion="user" (coque) coupe le déplacement.
import { ListTodo } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import type { Side } from "@/modules/core/sides";
import type { Task } from "@/modules/tasks/queries";
import { groupBySection, type SectionKey } from "@/modules/tasks/view";

import { ShowAllSpacesButton } from "./ShowAllSpacesButton";
import { TaskRow } from "./TaskRow";

const LEAVE = { opacity: 0, y: 8 };
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

// La section dit déjà le jour : la date n'est pas répétée sur chaque ligne.
const SECTIONS_WITHOUT_DATE: readonly SectionKey[] = ["today", "tomorrow"];

type TaskListProps = {
  tasks: Task[];
  /** Jour local `YYYY-MM-DD` (`todayIn(getUserTimeZone(), now)`, calculé par la page). */
  today: string;
  /** Côté actif : « Voir tous les espaces » retire le filtre de ce côté. */
  side: Side;
  /** Un espace est filtré : état vide filtré (« Rien dans cet espace »). */
  filtered: boolean;
  /** Pastille d'espace sur les lignes : seulement s'il y a à distinguer (plusieurs espaces, aucun filtré). */
  showContext: boolean;
  /** Requête de la liste gardée par le lien du détail (`?completed=1` ou rien). */
  listQuery: string;
};

export function TaskList({
  tasks,
  today,
  side,
  filtered,
  showContext,
  listQuery,
}: TaskListProps) {
  const t = useTranslations("tasks.list");
  const sections = groupBySection(tasks, today);

  if (sections.length === 0) {
    return (
      <section className="glass flex w-full max-w-3xl flex-col items-start gap-3 rounded-tile p-tile">
        <span className="flex size-11 items-center justify-center rounded-lg bg-row text-link">
          <ListTodo aria-hidden="true" className="size-5.5" strokeWidth={2} />
        </span>
        {filtered ? (
          <>
            <p className="text-body text-foreground">{t("emptyFiltered")}</p>
            <ShowAllSpacesButton side={side} />
          </>
        ) : (
          <>
            <p className="max-w-prose text-body text-foreground">
              {t("empty")}
            </p>
            <QuickAddTrigger
              label={t("add")}
              className="min-h-11 rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              {t("add")}
            </QuickAddTrigger>
          </>
        )}
      </section>
    );
  }

  return (
    <div className="glass flex w-full max-w-3xl flex-col gap-6 rounded-tile p-tile">
      <AnimatePresence initial={false}>
        {sections.map((section) => {
          const headingId = `tasks-section-${section.key}`;
          return (
            <motion.section
              key={section.key}
              aria-labelledby={headingId}
              exit={LEAVE}
              transition={SPRING}
              className="flex flex-col gap-3"
            >
              <div className="flex items-baseline gap-2 px-1">
                <h2
                  id={headingId}
                  className="text-eyebrow text-muted-foreground uppercase"
                >
                  {t(`sections.${section.key}`)}
                </h2>
                <span
                  aria-hidden="true"
                  className="font-heading text-eyebrow text-muted-foreground"
                >
                  {section.tasks.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {section.tasks.map((task) => (
                    <motion.li
                      key={task.id}
                      initial={LEAVE}
                      animate={{ opacity: 1, y: 0 }}
                      exit={LEAVE}
                      transition={SPRING}
                    >
                      <TaskRow
                        task={task}
                        overdue={section.key === "overdue"}
                        showDate={!SECTIONS_WITHOUT_DATE.includes(section.key)}
                        showContext={showContext}
                        listQuery={listQuery}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
