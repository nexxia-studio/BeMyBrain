// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Page du tableau de bord (BRAIN-7) : le corps, session comprise (requireSessionWithToken en tête), est dans
// render-dashboard.tsx, partagé avec la route lente de la démo ; la page passe le chemin du cookie des hauteurs
// relevées (QA-6 d'effets-de-verre), celui de sa route.
import { HOME_PATH } from "@/lib/auth/routes";

import { renderDashboard } from "./render-dashboard";

export default async function DashboardPage() {
  return renderDashboard({ tileHeightsPath: HOME_PATH });
}
