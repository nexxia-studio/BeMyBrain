// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/tasks` : titre, puis une tuile de lignes squelettes (forme de la liste, sans texte inventé).
// Squelettes immobiles : aucune boucle (DESIGN.md § 11). Une colonne à toutes les largeurs.
import { getTranslations } from "next-intl/server";

const SKELETON_ROWS = 4;

export default async function TasksLoading() {
  const t = await getTranslations("tasks.list");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <h1 className="font-heading text-page-title">{t("title")}</h1>
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div
        aria-hidden="true"
        data-testid="tasks-skeleton"
        className="glass flex flex-col gap-3 rounded-tile p-tile"
      >
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
    </main>
  );
}
