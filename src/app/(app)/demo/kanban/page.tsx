// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Démo du kanban (BRAIN-46) : juger au doigt le glisser-déposer avant la spec. Tâches fictives en mémoire,
// aucune base, aucune action serveur. Fermée en production (404) : voir demo-access.ts ; garde d'environnement
// avant toute lecture de session. Réglages en tête, puis le tableau (repli sous 768 px : voir SortableBoard).
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { requireSession } from "@/lib/session";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";

import { isKanbanDemoEnabled } from "./demo-access";
import { KanbanDemo } from "./KanbanDemo";

export default async function KanbanDemoPage() {
  if (
    !isKanbanDemoEnabled({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound();
  }

  // Session seule (frontend.md) : la page ne garde pas le jeton et ne lit aucune donnée métier.
  await requireSession();
  const t = await getTranslations("kanbanDemo");
  // « Aujourd'hui » calculé une fois côté serveur : mêmes échéances au rendu serveur et à l'hydratation.
  const today = todayIn(getUserTimeZone(), new Date());

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <KanbanDemo today={today} />
    </main>
  );
}
