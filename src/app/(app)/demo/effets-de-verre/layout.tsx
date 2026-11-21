// Garde de toute la démo des effets de verre (routes lentes comprises), au-dessus des `loading.tsx` : un
// `loading.tsx` enveloppe sa page dans un Suspense, donc une garde posée dans la page seule laisserait le givre
// (et ses lectures) partir dans le flux avant le notFound(), en 200 au lieu de 404. Ici, le 404 tombe avant
// tout rendu de la démo, sans lire la session ni le cookie. Chaque page garde aussi sa propre garde (défense
// en profondeur). Le layout `(app)` au-dessus lit la session avant : hors de notre portée, il ne lit aucune
// donnée de la démo.
// Réglage d'intensité du givre (QA-1) : au-dessus des enfants, donc au même endroit pendant le chargement
// ralenti et après. Le cran du cookie est posé en variables CSS sur une enveloppe `display: contents` (aucune
// boîte : la page garde sa place dans la colonne), dont givre et page héritent.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts), cookie
// et réglage compris.
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { isGlassDemoEnabled } from "./demo-access";
import {
  FROST_LEVEL_COOKIE,
  FROST_LEVEL_VARS,
  parseFrostLevel,
} from "./frost-levels";
import { FrostLevelPicker } from "./FrostLevelPicker";

export default async function GlassDemoLayout({
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

  const level = parseFrostLevel(
    (await cookies()).get(FROST_LEVEL_COOKIE)?.value,
  );

  return (
    <>
      <FrostLevelPicker current={level} />
      <div
        data-testid="frost-level"
        className="contents"
        style={FROST_LEVEL_VARS[level] as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
