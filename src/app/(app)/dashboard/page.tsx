// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tableau de bord bento (BRAIN-7, DESIGN.md § 5–7) : titre et filtre d'espace (mobile), tuile pleine
// « Aujourd'hui » (to-do du jour, des deux côtés), puis les tuiles du côté actif, restreintes aux espaces
// retenus : la To-do du côté montre ses prochaines tâches, les autres sont vides. Une tuile dont la lecture
// échoue affiche son erreur sans faire tomber la page (settleTile). Repli sous 768 px : une colonne, sauf la
// paire de tuiles chiffre (BentoGrid).
import { getTranslations } from "next-intl/server";

import { BentoGrid } from "@/components/bento/BentoGrid";
import { EmptyTile } from "@/components/bento/EmptyTile";
import { TodayTile } from "@/components/bento/TodayTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { SideTodoTile } from "@/components/tasks/SideTodoTile";
import { loadCurrentScope, loadSideSpaces } from "@/lib/context-filter";
import { requireSessionWithToken } from "@/lib/session";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { buildDashboard } from "@/modules/dashboard/tiles";
import { loadDueToday, loadUpcomingTasks } from "@/modules/tasks/load";
import { SIDE_TILE_LIMIT, todayTileItems } from "@/modules/tasks/view";

import { settleTile } from "./settle-tile";

export default async function DashboardPage() {
  // Mémoïsées par requête : le layout les a déjà appelées, pas de seconde lecture.
  const [{ session, token }, sideSpaces, scope, t] = await Promise.all([
    requireSessionWithToken(),
    loadSideSpaces(),
    loadCurrentScope(),
    getTranslations("dashboard"),
  ]);
  const dashboard = buildDashboard(sideSpaces);
  const today = todayIn(getUserTimeZone(), new Date());
  const hasTodoTile = dashboard.tiles.some((tile) => tile.content === "tasks");

  const [due, upcoming] = await Promise.all([
    settleTile("today", () => loadDueToday(token, session.workspaceId, today)),
    hasTodoTile
      ? settleTile("sideTodo", () =>
          loadUpcomingTasks(token, session.workspaceId, {
            side: scope.side,
            ...(scope.contextId !== null && { contextId: scope.contextId }),
            limit: SIDE_TILE_LIMIT,
          }),
        )
      : [],
  ]);

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} />
      <BentoGrid side={dashboard.side}>
        <TodayTile
          hasSpaces={dashboard.spaces.length > 0}
          workspaceName={session.workspaceName}
          today={today}
          due={due === null ? null : todayTileItems(due, today)}
        />
        {dashboard.tiles.map((tile) =>
          tile.content === "tasks" ? (
            <SideTodoTile
              key={tile.id}
              tile={tile}
              tasks={upcoming}
              today={today}
              // Même règle que la liste : un seul espace, ou un espace filtré, rien à nommer.
              showContext={
                scope.contextId === null && scope.contexts.length > 1
              }
            />
          ) : (
            <EmptyTile key={tile.id} tile={tile} />
          ),
        )}
      </BentoGrid>
    </main>
  );
}
