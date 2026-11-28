// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/lists/shopping` (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête, puis
// quelques tuiles de verre givrées dans une colonne bornée comme la liste (max-w-3xl). CSS pur, aucune boucle.
// Courses ne dépend pas du filtre d'espace : pas de pastille (`contextFilter: false`).
// raccourci: squelette générique (rayons et nombre d'articles inconnus avant la lecture) — le calquer sur
// les vrais rayons si le saut de mise en page gêne.
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";

const FROST_AISLES = [1, 2, 3];

export default async function ShoppingLoading() {
  const t = await getTranslations("shopping");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="shopping-frost"
        className="flex w-full max-w-3xl flex-col gap-grid"
      >
        {FROST_AISLES.map((i) => (
          <FrostTile key={i} index={i} className="h-32" />
        ))}
      </div>
    </main>
  );
}
