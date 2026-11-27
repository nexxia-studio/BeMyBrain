// Curseurs nexxia-design (spec todo-unifiee et todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// `/tasks` : titre, filtre d'espace (existant) et sélecteur de vue Liste / Tableau (cookie, liste par défaut) ;
// puis la vue mémorisée, du côté actif et de l'espace filtré ; puis le lien vers la corbeille.
// - Liste (spec todo-unifiee, « Liste ») : interrupteur « Terminées » dans l'en-tête, sections d'échéance. Une
//   colonne à toutes les largeurs (repli sous 768 px sans objet).
// - Tableau (spec todo-kanban, « Tableau ») : options de sous-tâches au-dessus, puis les colonnes de statut ;
//   repli sous 768 px : une colonne à la fois sous des onglets (`SortableBoard`). Terminée et Annulée : 20 cartes,
//   « Tout voir » par l'adresse (`?done=all`, `?canceled=all`), qui porte la limite au plafond de lecture.
// Lecture côté serveur uniquement (aucun zod dans le bundle client), `workspaceId` de la session ;
// « aujourd'hui » dans le fuseau de l'utilisateur.
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { TASKS_PATH, TRASH_PATH } from "@/components/shell/nav-items";
import { BoardOptions } from "@/components/tasks/BoardOptions";
import { CompletedToggle } from "@/components/tasks/CompletedToggle";
import {
  CANCELED_PARAM,
  COMPLETED_PARAM,
  DONE_PARAM,
  listQuery,
  listQueryWith,
  SEE_ALL,
} from "@/components/tasks/list-query";
import { type SeeAll, TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskList } from "@/components/tasks/TaskList";
import { ViewSwitch } from "@/components/tasks/ViewSwitch";
import { loadCurrentScope } from "@/lib/context-filter";
import { readBoardOptions, readTasksView } from "@/lib/preferences";
import { requireSessionWithToken } from "@/lib/session";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { loadBoard, loadTaskList } from "@/modules/tasks/load";
import {
  BOARD_CLOSED_DEFAULT_LIMIT,
  statusCategories,
  TASK_LIST_MAX_LIMIT,
} from "@/modules/tasks/sides";
import { showContextChip } from "@/modules/tasks/view";

type Search = Record<string, string | string[] | undefined>;

type TasksPageProps = {
  searchParams: Promise<Search>;
};

/** « Tout voir » d'une colonne fermée : état de l'adresse et lien vers l'état inverse, autres paramètres gardés. */
function seeAllOf(search: Search, param: string): SeeAll {
  const expanded = search[param] === SEE_ALL;
  return {
    expanded,
    href: `${TASKS_PATH}${listQueryWith(search, param, expanded ? null : SEE_ALL)}`,
  };
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  // Mémoïsées par requête : le layout les a déjà appelées, pas de seconde lecture.
  const [{ session, token }, scope, t, search, view] = await Promise.all([
    requireSessionWithToken(),
    loadCurrentScope(),
    getTranslations("tasks.list"),
    searchParams,
    readTasksView(),
  ]);
  const today = todayIn(getUserTimeZone(), new Date());
  const place = {
    side: scope.side,
    ...(scope.contextId !== null && { contextId: scope.contextId }),
  };
  const trashLink = (
    <Link
      href={TRASH_PATH}
      className="flex min-h-11 items-center gap-2 self-start text-small font-semibold text-link no-underline hover:text-link-hover"
    >
      <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
      {t("trash")}
    </Link>
  );

  if (view === "board") {
    const options = await readBoardOptions();
    const seeAll = {
      completed: seeAllOf(search, DONE_PARAM),
      canceled: seeAllOf(search, CANCELED_PARAM),
    };
    const limit = ({ expanded }: SeeAll) =>
      expanded ? TASK_LIST_MAX_LIMIT : BOARD_CLOSED_DEFAULT_LIMIT;
    const board = await loadBoard(token, session.workspaceId, {
      ...place,
      includeSubtasks: options.subtasks,
      hideCompletedSubtasks: options.hideDoneSubtasks,
      completedLimit: limit(seeAll.completed),
      canceledLimit: limit(seeAll.canceled),
    });

    return (
      <main className="flex flex-1 flex-col gap-grid">
        <PageHeader title={t("title")} actions={<ViewSwitch view={view} />} />
        <BoardOptions
          subtasks={options.subtasks}
          hideDoneSubtasks={options.hideDoneSubtasks}
        />
        <TaskBoard
          columns={board.columns}
          today={today}
          showContext={showContextChip(scope)}
          listQuery={listQuery(search)}
          canceledOpen={options.canceledOpen}
          seeAll={seeAll}
          side={scope.side}
          filtered={scope.contextId !== null}
          scopeKey={[
            scope.side,
            scope.contextId,
            options.subtasks,
            options.hideDoneSubtasks,
          ].join(":")}
        />
        {trashLink}
      </main>
    );
  }

  const showCompleted = search[COMPLETED_PARAM] === "1";
  // raccourci: une seule lecture plafonnée à 200 (plafond de tasks.list), sous-tâches sans échéance et
  // terminées comprises — pagination ou lecture par section si une liste dépasse ce volume.
  const list = await loadTaskList(token, session.workspaceId, {
    ...place,
    limit: TASK_LIST_MAX_LIMIT,
    ...(showCompleted && { statusCategories: [...statusCategories] }),
  });

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader
        title={t("title")}
        actions={
          <>
            <ViewSwitch view={view} />
            <CompletedToggle
              checked={showCompleted}
              href={
                showCompleted
                  ? TASKS_PATH
                  : `${TASKS_PATH}?${COMPLETED_PARAM}=1`
              }
            />
          </>
        }
      />
      <TaskList
        tasks={list.tasks}
        today={today}
        side={scope.side}
        filtered={scope.contextId !== null}
        showContext={showContextChip(scope)}
        listQuery={listQuery(search)}
      />
      {list.truncated && (
        <p className="text-caption text-foreground">
          {t("truncated", { count: TASK_LIST_MAX_LIMIT })}
        </p>
      )}
      {trashLink}
    </main>
  );
}
