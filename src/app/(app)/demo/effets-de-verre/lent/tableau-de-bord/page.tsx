// Tableau de bord au chargement ralenti (démo des effets de verre, essai iPhone) : la vraie page, rendue après
// SLOW_LOAD_MS, pour voir le givre de `dashboard/loading.tsx`. Garde d'environnement d'abord (404 sans lire la
// session), puis session, puis délai : aucun délai pour un visiteur sans session.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).
import { notFound } from "next/navigation";

import { renderDashboard } from "@/app/(app)/dashboard/render-dashboard";
import { requireSessionWithToken } from "@/lib/session";

import { isGlassDemoEnabled } from "../../demo-access";
import { waitSlowLoad } from "../slow-load";

// Cookie des hauteurs relevées (QA-6) au chemin de cette route : le givre de la route lente le relit.
// raccourci: route temporaire, retirée avec la démo à la dernière tâche du plan effets-de-verre.
const SLOW_DASHBOARD_PATH = "/demo/effets-de-verre/lent/tableau-de-bord";

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

  return renderDashboard({ tileHeightsPath: SLOW_DASHBOARD_PATH });
}
