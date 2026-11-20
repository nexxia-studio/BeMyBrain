// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/trash` (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête (sans filtre
// d'espace, comme la page), puis une tuile givrée pleine largeur, comme TrashList. Une colonne à toutes
// les largeurs. CSS pur, aucune boucle.
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";

export default async function TrashLoading() {
  const t = await getTranslations("trash");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      {/* raccourci: hauteur minimale fixe (celle d'une tuile large) — la corbeille réelle peut être plus haute ou
          plus basse ; seul le bas de la tuile bouge, jamais le titre ni son bord haut. */}
      <div aria-hidden="true" data-testid="trash-frost">
        <FrostTile className="min-h-75" />
      </div>
    </main>
  );
}
