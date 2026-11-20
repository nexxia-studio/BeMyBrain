// Tableau de bord au chargement ralenti (démo des effets de verre, essai iPhone) : la vraie page, rendue après
// SLOW_LOAD_MS, pour voir le givre de `dashboard/loading.tsx`. Garde d'environnement d'abord (404 sans lire la
// session), puis session, puis délai : aucun délai pour un visiteur sans session.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).
import { notFound } from "next/navigation";

import DashboardPage from "@/app/(app)/dashboard/page";
import { requireSessionWithToken } from "@/lib/session";

import { isGlassDemoEnabled } from "../../demo-access";
import { waitSlowLoad } from "../slow-load";

export default async function SlowDashboardPage() {
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

  return <DashboardPage />;
}
