// Garde de toute la démo du kanban, au-dessus de tout `loading.tsx` (leçon de la démo des effets de verre,
// `508988b`) : le 404 tombe avant tout rendu de la démo, sans lire la session. La page garde aussi sa propre
// garde (défense en profondeur). Le layout `(app)` au-dessus lit la session avant : hors de notre portée, il ne
// lit aucune donnée de la démo.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban (demo-access.ts).
import { notFound } from "next/navigation";

import { isKanbanDemoEnabled } from "./demo-access";

export default function KanbanDemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (
    !isKanbanDemoEnabled({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound();
  }

  return children;
}
