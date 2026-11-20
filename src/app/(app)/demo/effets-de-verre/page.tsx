// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Page de démo des effets de verre (BRAIN-33), réduite à l'essai iPhone : « Revoir le reflet » et les deux
// chargements ralentis. Fermée en production (404) : voir demo-access.ts. Garde d'environnement avant toute
// lecture de session. Une colonne à toutes les largeurs.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { requireSessionWithToken } from "@/lib/session";

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

  await requireSessionWithToken();
  const t = await getTranslations("glassDemo");

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} />
      <GlassDemo />
    </main>
  );
}
