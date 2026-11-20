// Garde de toute la démo des effets de verre (routes lentes comprises), au-dessus des `loading.tsx` : un
// `loading.tsx` enveloppe sa page dans un Suspense, donc une garde posée dans la page seule laisserait le givre
// (et ses lectures) partir dans le flux avant le notFound(), en 200 au lieu de 404. Ici, le 404 tombe avant
// tout rendu de la démo, sans lire la session. Chaque page garde aussi sa propre garde (défense en profondeur).
// Le layout `(app)` au-dessus lit la session avant : hors de notre portée, il ne lit aucune donnée de la démo.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).
import { notFound } from "next/navigation";

import { isGlassDemoEnabled } from "./demo-access";

export default function GlassDemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (
    !isGlassDemoEnabled({
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    })
  ) {
    notFound();
  }

  return children;
}
