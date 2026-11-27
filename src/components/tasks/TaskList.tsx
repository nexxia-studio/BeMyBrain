"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Liste `/tasks` (spec todo-unifiee, « Liste » ; surfaces « Creux » de la spec todo-kanban, DESIGN.md § 5) :
// sections d'échéance (En retard, Aujourd'hui, Demain, Plus tard, Sans échéance, puis Terminées si l'interrupteur
// les montre), chacune dans un creux `pill-track` posé à nu sur la brume, comme une colonne du tableau : aucun
// verre. Titre de section en surtitre suivi de son compteur, tous deux à l'encre (jamais de texte secondaire sur
// le creux) ; lignes en cartes claires (`popover`, contour `border`, `shadow-raised`). Survol d'une ligne
// (pointeur fin) : contour `input`, sans montée (une ligne n'est pas déplaçable). État vide : une tuile de verre.
// Une colonne à toutes les largeurs ; sur ordinateur, liste bornée (`max-w-3xl`) pour que titre et légende
// restent dans le regard. Règles de sections et d'ordre : `groupBySection` (src/modules/tasks/view.ts), pas ici.
// Mouvement (DESIGN.md § 7) : une ligne qui quitte la liste (cochée, rendu serveur reçu) sort en `opacity`
// + `y` 8, ressort sans rebond, 0,3 s ; une section vidée sort de même. Rien à l'affichage initial.
// MotionConfig reducedMotion="user" (coque) coupe le déplacement.
import { ListTodo } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import { cn } from "@/lib/utils";
import type { Side } from "@/modules/core/sides";
import type { Task } from "@/modules/tasks/queries";
import { groupBySection, type SectionKey } from "@/modules/tasks/view";

import { ShowAllSpacesButton } from "./ShowAllSpacesButton";
import {
  TASK_LIST_CLASSES,
  TASK_LIST_ROW_SURFACE_CLASSES,
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "./task-list-layout";
import { TaskRow } from "./TaskRow";

const LEAVE = { opacity: 0, y: 8 };
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

// Ligne de la liste : carte claire à la place de `row` ; au survol du lien, le fond reste opaque et le contour
// passe à `input` (comme une carte du tableau, sans ombre ajoutée ni montée).
const ROW_SURFACE = cn(
  TASK_LIST_ROW_SURFACE_CLASSES,
  "has-[a:hover]:bg-popover pointer-fine:has-[a:hover]:outline-input",
);

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
    <div className={TASK_LIST_CLASSES}>
      <AnimatePresence initial={false}>
        {sections.map((section) => {
          const headingId = `tasks-section-${section.key}`;
          return (
            <motion.section
              key={section.key}
              aria-labelledby={headingId}
              exit={LEAVE}
              transition={SPRING}
              className={TASK_SECTION_CLASSES}
            >
              <div className={TASK_SECTION_HEADER_CLASSES}>
                <h2
                  id={headingId}
                  className={cn(
                    TASK_SECTION_HEADING_TEXT,
                    "text-foreground uppercase",
                  )}
                >
                  {t(`sections.${section.key}`)}
                </h2>
                <span
                  aria-hidden="true"
                  className={cn(
                    TASK_SECTION_HEADING_TEXT,
                    "font-heading text-foreground",
                  )}
                >
                  {section.tasks.length}
                </span>
              </div>
              <ul className={TASK_ROWS_CLASSES}>
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
                        className={ROW_SURFACE}
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
