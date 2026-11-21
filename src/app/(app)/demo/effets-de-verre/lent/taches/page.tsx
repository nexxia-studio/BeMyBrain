// Liste des tâches au chargement ralenti (démo des effets de verre, essai iPhone) : la vraie page, rendue après
// SLOW_LOAD_MS, pour voir le givre de `tasks/loading.tsx`. Garde d'environnement d'abord (404 sans lire la
// session), puis session, puis délai. Le layout de `/tasks` n'est pas repris : la liste n'en dépend pas (seul le
// détail lit TaskTrashProvider) ; un clic sur une tâche, « Terminées » ou la corbeille quitte la route lente.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).
import { notFound } from "next/navigation";

import TasksPage from "@/app/(app)/tasks/page";
import { requireSessionWithToken } from "@/lib/session";

import { isGlassDemoEnabled } from "../../demo-access";
import { waitSlowLoad } from "../slow-load";

type SlowTasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SlowTasksPage({
  searchParams,
}: SlowTasksPageProps) {
  if (
    !isGlassDemoEnabled({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound();
  }

  await requireSessionWithToken();
  await waitSlowLoad();

  return <TasksPage searchParams={searchParams} />;
}
