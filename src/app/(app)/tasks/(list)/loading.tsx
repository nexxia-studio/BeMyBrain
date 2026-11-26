// Curseurs nexxia-design (spec todo-unifiee et todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/tasks` (DESIGN.md § 5 « États de chargement — givre ») : dans le groupe `(list)`, il
// n'enveloppe que la liste ou le tableau, pas l'emplacement `@detail` (BRAIN-54, voir `../layout.tsx`). Il
// ressemble à la vue mémorisée (cookie `bmb_tasks_view`, lu au rendu serveur : aucun script, aucun éclair).
// Vue Liste : le vrai en-tête, puis une section de la liste givrée, sans verre (surfaces « Creux », comme la
// vraie liste) : un creux `pill-track` voilé, son en-tête (place réservée) et six lignes en cartes claires
// voilées, chacune à la hauteur d'une ligne
// dont le titre et la légende tiennent sur une ligne (QA-3, décision d'Antoine du 2026-11-21 : squelette
// générique, sans mémorisation). Classes de la liste, de la section et des lignes lues dans task-list-layout.ts,
// comme TaskList et TaskRow ; hauteurs de texte par des cales `h-lh` aux mêmes tailles (légende : la même cale de
// pastille que TaskRow, présente avec ou sans pastille). La première section et
// sa première ligne se posent donc là où était le givre ; plus bas, un ajustement est accepté (titres sur deux
// lignes, légende plus haute, nombre de lignes). Une colonne à toutes les largeurs.
// Vue Tableau : le vrai en-tête, la place de la rangée d'options, puis `TaskBoardFrost` (repli sous 768 px : une
// colonne sous la barre d'onglets, comme le tableau).
// Contrôles de l'en-tête (sélecteur de vue ; interrupteur « Terminées » en vue Liste) et rangée d'options du
// tableau : rendus invisibles et inertes, ils réservent leur place (leur taille ne dépend pas de leur état). CSS
// pur, aucune boucle.
// Filtre d'espace de l'en-tête (mobile) : place réservée, invisible et inerte (`filterInert`) ; utilisable
// seulement une fois la page chargée.
// En-tête : lectures mémoïsées par requête, déjà faites par le layout (aucune requête en plus).
// Limite assumée (comme le tableau de bord, DESIGN.md § 5) : pendant une navigation dans l'app, Next peut
// réutiliser un chargement préchargé avant un changement de vue.
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { BoardOptions } from "@/components/tasks/BoardOptions";
import { CompletedToggle } from "@/components/tasks/CompletedToggle";
import {
  TASK_LIST_CLASSES,
  TASK_LIST_ROW_SURFACE_CLASSES,
  TASK_ROW_CLASSES,
  TASK_ROW_LEGEND_CLASSES,
  TASK_ROW_LEGEND_STRUT_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "@/components/tasks/task-list-layout";
import { TaskBoardFrost } from "@/components/tasks/TaskBoardFrost";
import { ViewSwitch } from "@/components/tasks/ViewSwitch";
import { readBoardOptions, readTasksView } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/** Lignes du givre : assez pour remplir un écran de téléphone, toujours les mêmes. */
const FROST_ROWS = [1, 2, 3, 4, 5, 6];

export default async function TasksLoading() {
  const [t, view] = await Promise.all([
    getTranslations("tasks.list"),
    readTasksView(),
  ]);
  const viewSwitch = (
    <div aria-hidden="true" inert className="invisible">
      <ViewSwitch view={view} />
    </div>
  );
  const status = (
    <p role="status" className="sr-only">
      {t("loading")}
    </p>
  );

  if (view === "board") {
    const [options, tStatus] = await Promise.all([
      readBoardOptions(),
      getTranslations("tasks.detail.status"),
    ]);
    return (
      <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
        <PageHeader title={t("title")} filterInert actions={viewSwitch} />
        {status}
        <div aria-hidden="true" inert className="invisible">
          <BoardOptions
            subtasks={options.subtasks}
            hideDoneSubtasks={options.hideDoneSubtasks}
          />
        </div>
        <TaskBoardFrost
          canceledOpen={options.canceledOpen}
          canceledLabel={tStatus("canceled")}
        />
      </main>
    );
  }

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader
        title={t("title")}
        filterInert
        actions={
          <>
            {viewSwitch}
            <div aria-hidden="true" inert className="invisible">
              <CompletedToggle checked={false} href={TASKS_PATH} />
            </div>
          </>
        }
      />
      {status}
      <div aria-hidden="true" data-testid="tasks-frost">
        <div className={TASK_LIST_CLASSES}>
          <FrostTile variant="row" className={TASK_SECTION_CLASSES}>
            <div
              data-testid="tasks-frost-section-header"
              className={TASK_SECTION_HEADER_CLASSES}
            >
              <div className={`${TASK_SECTION_HEADING_TEXT} h-lh`} />
            </div>
            <div className={TASK_ROWS_CLASSES}>
              {FROST_ROWS.map((index) => (
                <FrostTile
                  key={index}
                  variant="row"
                  index={index}
                  testId="tasks-frost-row"
                  className={cn(
                    TASK_ROW_CLASSES,
                    TASK_LIST_ROW_SURFACE_CLASSES,
                  )}
                >
                  <div className={TASK_ROW_LINE_CLASSES}>
                    <div className={TASK_ROW_TEXT_CLASSES}>
                      <div className={`${TASK_ROW_TITLE_TEXT} h-lh`} />
                      <div
                        className={`${TASK_ROW_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`}
                      >
                        <div className={TASK_ROW_LEGEND_STRUT_CLASSES} />
                      </div>
                    </div>
                  </div>
                </FrostTile>
              ))}
            </div>
          </FrostTile>
        </div>
      </div>
    </main>
  );
}
