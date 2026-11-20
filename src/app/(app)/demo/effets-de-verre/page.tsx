// Page de démo des effets de verre (BRAIN-33) : les trois directions sur la vraie grille du tableau de bord.
// Fermée en production (404) : voir demo-access.ts. Mêmes lectures que le tableau de bord.
// raccourci: lectures recopiées de dashboard/page.tsx, page temporaire retirée une fois la direction choisie.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { EmptyTile } from "@/components/bento/EmptyTile";
import { TodayTile } from "@/components/bento/TodayTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { SideTodoTile } from "@/components/tasks/SideTodoTile";
import { loadCurrentScope, loadSideSpaces } from "@/lib/context-filter";
import { requireSessionWithToken } from "@/lib/session";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";
import { buildDashboard } from "@/modules/dashboard/tiles";
import { loadDueToday, loadUpcomingTasks } from "@/modules/tasks/load";
import {
  showContextChip,
  SIDE_TILE_LIMIT,
  todayTileItems,
} from "@/modules/tasks/view";

import { settleTile } from "../../dashboard/settle-tile";
import { isGlassDemoEnabled } from "./demo-access";
import { GlassDemo } from "./GlassDemo";

export default async function GlassDemoPage() {
  if (
    !isGlassDemoEnabled({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound();
  }

  const [{ session, token }, sideSpaces, scope, t] = await Promise.all([
    requireSessionWithToken(),
    loadSideSpaces(),
    loadCurrentScope(),
    getTranslations("glassDemo"),
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
      <GlassDemo>
        <TodayTile
          hasSpaces={dashboard.spaces.length > 0}
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
              showContext={showContextChip(scope)}
            />
          ) : (
            <EmptyTile key={tile.id} tile={tile} />
          ),
        )}
      </GlassDemo>
    </main>
  );
}
