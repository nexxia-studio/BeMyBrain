// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/tasks` (DESIGN.md § 5 « États de chargement — givre ») : dans le groupe `(list)`, il
// n'enveloppe que la liste, pas l'emplacement `@detail` (BRAIN-54, voir `../layout.tsx`). Le vrai en-tête, puis la tuile de la
// liste givrée : un en-tête de section (place réservée) et six lignes givrées, chacune à la hauteur d'une ligne
// dont le titre et la légende tiennent sur une ligne (QA-3, décision d'Antoine du 2026-11-21 : squelette
// générique, sans mémorisation). Classes de la tuile, de la section et des lignes lues dans task-list-layout.ts,
// comme TaskList et TaskRow ; hauteurs de texte par des cales `h-lh` aux mêmes tailles (légende : la même cale de
// pastille que TaskRow, présente avec ou sans pastille). La première section et
// sa première ligne se posent donc là où était le givre ; plus bas, un ajustement est accepté (titres sur deux
// lignes, légende plus haute, nombre de lignes). L'interrupteur « Terminées » est rendu invisible et inerte : il
// réserve sa place (sa taille ne dépend pas de son état). Une colonne à toutes les largeurs. CSS pur, aucune
// boucle.
// Filtre d'espace de l'en-tête (mobile) : place réservée, invisible et inerte (`filterInert`) ; utilisable
// seulement une fois la page chargée.
// En-tête : lectures mémoïsées par requête, déjà faites par le layout (aucune requête en plus).
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { CompletedToggle } from "@/components/tasks/CompletedToggle";
import {
  TASK_LIST_TILE_CLASSES,
  TASK_ROW_CLASSES,
  TASK_ROW_LEGEND_CLASSES,
  TASK_ROW_LEGEND_STRUT_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "@/components/tasks/task-list-layout";

/** Lignes du givre : assez pour remplir un écran de téléphone, toujours les mêmes. */
const FROST_ROWS = [1, 2, 3, 4, 5, 6];

export default async function TasksLoading() {
  const t = await getTranslations("tasks.list");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader
        title={t("title")}
        filterInert
        actions={
          <div aria-hidden="true" inert className="invisible">
            <CompletedToggle checked={false} href={TASKS_PATH} />
          </div>
        }
      />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" data-testid="tasks-frost">
        <FrostTile className={TASK_LIST_TILE_CLASSES}>
          <div className={TASK_SECTION_CLASSES}>
            <div
              data-testid="tasks-frost-section-header"
              className={TASK_SECTION_HEADER_CLASSES}
            >
              <div className={`${TASK_SECTION_HEADING_TEXT} h-lh`} />
            </div>
            <div className={TASK_ROWS_CLASSES}>
              {FROST_ROWS.map((index) => (
                <FrostTile
                  key={index}
                  variant="row"
                  index={index}
                  testId="tasks-frost-row"
                  className={TASK_ROW_CLASSES}
                >
                  <div className={TASK_ROW_LINE_CLASSES}>
                    <div className={TASK_ROW_TEXT_CLASSES}>
                      <div className={`${TASK_ROW_TITLE_TEXT} h-lh`} />
                      <div
                        className={`${TASK_ROW_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`}
                      >
                        <div className={TASK_ROW_LEGEND_STRUT_CLASSES} />
                      </div>
                    </div>
                  </div>
                </FrostTile>
              ))}
            </div>
          </div>
        </FrostTile>
      </div>
    </main>
  );
}
