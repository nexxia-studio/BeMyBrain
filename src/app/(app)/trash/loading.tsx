// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Chargement de `/trash` (DESIGN.md § 5 « États de chargement — givre ») : le vrai en-tête (sans filtre
// d'espace, comme la page), puis la tuile de la corbeille givrée, pleine largeur comme TrashList : six lignes
// givrées, chacune à la hauteur d'une tâche à la corbeille dont le titre et la légende (pastille de côté) tiennent
// sur une ligne, puis la date (QA-3, squelette générique). Classes lues dans trash-list-layout.ts et
// task-list-layout.ts, comme TrashList, TrashRow et TaskTrashRow ; hauteurs de texte par des cales `h-lh` (et
// une pastille invisible en `box-content`, qui garde sa place sans montrer son contour) aux mêmes tailles. La première ligne se pose là où était le givre ; plus bas,
// un ajustement est accepté. Une colonne à toutes les largeurs. CSS pur, aucune boucle.
import { getTranslations } from "next-intl/server";

import { FrostTile } from "@/components/loading/FrostTile";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  SIDE_CHIP_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_TITLE_TEXT,
  TASK_TRASH_LEGEND_CLASSES,
  TASK_TRASH_ROW_CLASSES,
} from "@/components/tasks/task-list-layout";
import {
  TRASH_LIST_TILE_CLASSES,
  TRASH_ROW_CLASSES,
  TRASH_ROW_CONTENT_CLASSES,
  TRASH_ROW_DATE_TEXT,
  TRASH_ROW_LINE_CLASSES,
  TRASH_ROWS_CLASSES,
} from "@/components/trash/trash-list-layout";

/** Lignes du givre : assez pour remplir un écran de téléphone, toujours les mêmes. */
const FROST_ROWS = [1, 2, 3, 4, 5, 6];

export default async function TrashLoading() {
  const t = await getTranslations("trash");

  return (
    <main aria-busy="true" className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" data-testid="trash-frost">
        <FrostTile className={TRASH_LIST_TILE_CLASSES}>
          <div className={TRASH_ROWS_CLASSES}>
            {FROST_ROWS.map((index) => (
              <FrostTile
                key={index}
                variant="row"
                index={index}
                testId="trash-frost-row"
                className={TRASH_ROW_CLASSES}
              >
                <div className={TRASH_ROW_LINE_CLASSES}>
                  <div className={TRASH_ROW_CONTENT_CLASSES}>
                    <div className={TASK_TRASH_ROW_CLASSES}>
                      <div className={`${TASK_ROW_TITLE_TEXT} h-lh`} />
                      <div
                        className={`${TASK_TRASH_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`}
                      >
                        <div
                          className={`${SIDE_CHIP_CLASSES} invisible box-content h-lh`}
                        />
                      </div>
                    </div>
                    <div className={`${TRASH_ROW_DATE_TEXT} h-lh`} />
                  </div>
                </div>
              </FrostTile>
            ))}
          </div>
        </FrostTile>
      </div>
    </main>
  );
}
