// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/tasks` (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête, puis une tuile
// givrée à la largeur de la liste (`max-w-3xl`, comme TaskList). L'interrupteur « Terminées » est rendu
// invisible et inerte : il réserve sa place (sa taille ne dépend pas de son état) pour que le titre et la
// tuile ne bougent pas à l'arrivée du contenu. Une colonne à toutes les largeurs. CSS pur, aucune boucle.
// En-tête : lectures mémoïsées par requête, déjà faites par le layout (aucune requête en plus).
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { CompletedToggle } from "@/components/tasks/CompletedToggle";

export default async function TasksLoading() {
  const t = await getTranslations("tasks.list");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader
        title={t("title")}
        actions={
          <div aria-hidden="true" inert className="invisible">
            <CompletedToggle checked={false} href={TASKS_PATH} />
          </div>
        }
      />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      {/* raccourci: hauteur minimale fixe (celle d'une tuile large) — la liste réelle peut être plus haute ou plus
          basse ; seul le bas de la tuile bouge, jamais le titre ni son bord haut. */}
      <div aria-hidden="true" data-testid="tasks-frost">
        <FrostTile className="w-full max-w-3xl min-h-75" />
      </div>
    </main>
  );
}
