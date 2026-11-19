// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/trash` : titre, puis une tuile de lignes squelettes (forme de la corbeille, sans texte
// inventé). Squelettes immobiles : aucune boucle (DESIGN.md § 11). Une colonne à toutes les largeurs.
import { getTranslations } from "next-intl/server";

const SKELETON_ROWS = 3;

export default async function TrashLoading() {
  const t = await getTranslations("trash");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <h1 className="font-heading text-page-title">{t("title")}</h1>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="trash-skeleton"
        className="glass flex flex-col gap-2 rounded-tile p-tile"
      >
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <span
            key={index}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-row px-3.5 py-2.5"
          >
            <span className="flex w-2/3 flex-col gap-2">
              <span className="h-3 w-full rounded-full bg-track" />
              <span className="h-2.5 w-1/2 rounded-full bg-track" />
            </span>
            <span className="h-3 w-16 rounded-full bg-track" />
          </span>
        ))}
      </div>
    </main>
  );
}
