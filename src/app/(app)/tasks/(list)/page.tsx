// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Liste `/tasks` (spec todo-unifiee, « Liste ») : titre, filtre d'espace (existant) et interrupteur
// « Terminées » ; puis les sections d'échéance du côté actif et de l'espace filtré ; puis le lien vers la
// corbeille. Une colonne à toutes les largeurs (repli sous 768 px sans objet). Lecture côté serveur
// uniquement (aucun zod dans le bundle client) ; « aujourd'hui » dans le fuseau de l'utilisateur.
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { TASKS_PATH, TRASH_PATH } from "@/components/shell/nav-items";
import { CompletedToggle } from "@/components/tasks/CompletedToggle";
import { COMPLETED_PARAM, listQuery } from "@/components/tasks/list-query";
import { TaskList } from "@/components/tasks/TaskList";
import { ViewSwitch } from "@/components/tasks/ViewSwitch";
import { loadCurrentScope } from "@/lib/context-filter";
import { readTasksView } from "@/lib/preferences";
import { requireSessionWithToken } from "@/lib/session";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { loadTaskList } from "@/modules/tasks/load";
import { statusCategories, TASK_LIST_MAX_LIMIT } from "@/modules/tasks/sides";
import { showContextChip } from "@/modules/tasks/view";

// raccourci: le sélecteur de vue est complet (cookie, action, composant) mais le tableau n'existe pas encore : il
// reste masqué pour ne pas livrer un contrôle sans effet — retiré à la tâche 20 du plan todo-kanban, qui branche la vue.
const BOARD_VIEW_READY: boolean = false;

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  // Mémoïsées par requête : le layout les a déjà appelées, pas de seconde lecture.
  const [{ session, token }, scope, t, search, view] = await Promise.all([
    requireSessionWithToken(),
    loadCurrentScope(),
    getTranslations("tasks.list"),
    searchParams,
    readTasksView(),
  ]);
  const showCompleted = search[COMPLETED_PARAM] === "1";
  // raccourci: une seule lecture plafonnée à 200 (plafond de tasks.list), sous-tâches sans échéance et
  // terminées comprises — pagination ou lecture par section si une liste dépasse ce volume.
  const list = await loadTaskList(token, session.workspaceId, {
    side: scope.side,
    ...(scope.contextId !== null && { contextId: scope.contextId }),
    limit: TASK_LIST_MAX_LIMIT,
    ...(showCompleted && { statusCategories: [...statusCategories] }),
  });
  const today = todayIn(getUserTimeZone(), new Date());

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader
        title={t("title")}
        actions={
          <>
            {BOARD_VIEW_READY && <ViewSwitch view={view} />}
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
      <Link
        href={TRASH_PATH}
        className="flex min-h-11 items-center gap-2 self-start text-small font-semibold text-link no-underline hover:text-link-hover"
      >
        <Trash2 aria-hidden="true" className="size-4" strokeWidth={2} />
        {t("trash")}
      </Link>
    </main>
  );
}
