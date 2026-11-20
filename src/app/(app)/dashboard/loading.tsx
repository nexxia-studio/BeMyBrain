// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Chargement du tableau de bord : titre, puis la forme de la tuile pleine « Aujourd'hui » et d'une tuile verre
// de lignes (sans texte inventé). Squelettes immobiles : aucune boucle (DESIGN.md § 11). Même grille que la
// page (rangées flex-wrap) : une colonne sous 768 px.
import { getTranslations } from "next-intl/server";

const SKELETON_ROWS = 3;

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <h1 className="font-heading text-page-title">{t("title")}</h1>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="dashboard-skeleton"
        className="flex flex-wrap gap-grid"
      >
        <div className="flex min-w-0 grow-2 basis-100 flex-col gap-3 rounded-tile bg-primary p-today shadow-today lg:min-h-75">
          <span className="h-3 w-32 rounded-full bg-on-primary-surface" />
          <span className="h-8 w-40 rounded-full bg-on-primary-surface" />
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <span
              key={index}
              className="min-h-11 rounded-lg border border-on-primary-border bg-on-primary-surface"
            />
          ))}
        </div>
        <div className="glass flex min-w-0 grow-2 basis-100 flex-col gap-3 rounded-tile p-tile lg:min-h-75">
          <span className="h-3 w-24 rounded-full bg-track" />
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <span
              key={index}
              className="flex min-h-11 items-center gap-3 rounded-lg bg-row px-3.5"
            >
              <span className="size-4.5 shrink-0 rounded-sm bg-track" />
              <span className="h-3 w-2/3 rounded-full bg-track" />
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
