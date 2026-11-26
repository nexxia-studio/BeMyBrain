// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Givre du tableau `/tasks` (DESIGN.md § 5 « États de chargement — givre ») : composant serveur, CSS pur, aucune
// boucle. Même mise en page que `SortableBoard`, choisie par la largeur en CSS : sous 768 px, la barre d'onglets
// en verre puis la première colonne seule ; au-delà, cinq colonnes côte à côte, Annulée en bandeau replié ou en
// colonne selon la préférence mémorisée. Squelette générique, sans mémorisation, comme la liste : colonnes
// `pill-track` voilées, cartes opaques voilées (deux couches de voile, éclaircissement carte par carte).
// Classes de place et de taille lues dans `task-board-layout.ts` (partagées avec `TaskCard`, verrouillées contre
// `SortableBoard`) ; hauteurs de texte par des cales `h-lh` aux tailles réelles. Barre d'onglets, colonnes,
// en-têtes et première carte gardent donc leur place à l'arrivée du contenu ; plus bas, un ajustement est accepté
// (titres sur deux lignes, légende absente ou plus haute d'un badge, nombre de cartes).
// Le bandeau replié est large comme son libellé : il est écrit, invisible, pour donner la même largeur.
import { FrostTile } from "@/components/loading/FrostTile";
import { cn } from "@/lib/utils";
import { statusCategories } from "@/modules/tasks/sides";

import {
  BOARD_CARDS_CLASSES,
  BOARD_COLUMN_CLASSES,
  BOARD_COLUMN_FOLDED_CLASSES,
  BOARD_COLUMN_OPEN_CLASSES,
  BOARD_COLUMN_UNCHOSEN_CLASSES,
  BOARD_COLUMNS_CLASSES,
  BOARD_HEADER_CLASSES,
  BOARD_HEADER_FOLDED_CLASSES,
  BOARD_HEADING_CLASSES,
  BOARD_HEADING_FOLDED_CLASSES,
  BOARD_TAB_HEIGHT,
  BOARD_TABLIST_CLASSES,
  BOARD_TABS_CLASSES,
  BOARD_TOGGLE_CLASSES,
  TASK_CARD_CLASSES,
  TASK_CARD_LEGEND_CLASSES,
  TASK_CARD_LEGEND_TEXT,
  TASK_CARD_SHADOW,
  TASK_CARD_TITLE_TEXT,
} from "./task-board-layout";

/** Cartes givrées par colonne, toujours les mêmes : de quoi remplir un écran de téléphone dans la première. */
const FROST_CARDS = [4, 3, 2, 3, 2];

type TaskBoardFrostProps = {
  /** Colonne Annulée dépliée (cookie bmb_board_canceled_open) : sinon bandeau replié à partir de 768 px. */
  canceledOpen: boolean;
  /** Libellé traduit de la colonne Annulée : donne sa largeur au bandeau replié. */
  canceledLabel: string;
};

export function TaskBoardFrost({
  canceledOpen,
  canceledLabel,
}: TaskBoardFrostProps) {
  let cardIndex = 0;

  return (
    <div aria-hidden="true" data-testid="tasks-board-frost">
      <FrostTile
        variant="row"
        testId="tasks-board-frost-tabs"
        className={BOARD_TABS_CLASSES}
      >
        <div className={BOARD_TABLIST_CLASSES}>
          <div className={BOARD_TAB_HEIGHT} />
        </div>
      </FrostTile>
      <div className={BOARD_COLUMNS_CLASSES}>
        {statusCategories.map((category, column) => {
          const folded = category === "canceled" && !canceledOpen;
          return (
            <FrostTile
              key={category}
              variant="row"
              index={column}
              testId="tasks-board-frost-column"
              className={cn(
                BOARD_COLUMN_CLASSES,
                folded
                  ? BOARD_COLUMN_FOLDED_CLASSES
                  : BOARD_COLUMN_OPEN_CLASSES,
                column > 0 && BOARD_COLUMN_UNCHOSEN_CLASSES,
              )}
            >
              <div
                className={cn(
                  BOARD_HEADER_CLASSES,
                  folded && BOARD_HEADER_FOLDED_CLASSES,
                )}
              >
                <div
                  className={cn(
                    BOARD_HEADING_CLASSES,
                    // Le vrai titre est un `h2` : même police, même largeur de bandeau.
                    "font-heading",
                    folded && BOARD_HEADING_FOLDED_CLASSES,
                  )}
                >
                  {folded && (
                    <>
                      <span className="invisible">{canceledLabel}</span>
                      {/* Ligne du compteur : sa hauteur seulement. */}
                      <span className="h-lh" />
                    </>
                  )}
                </div>
                {category === "canceled" && (
                  <div className={BOARD_TOGGLE_CLASSES} />
                )}
              </div>
              {/* Bandeau replié : pas de cartes à partir de 768 px ; en dessous, la colonne n'est pas affichée. */}
              {!folded && (
                <div className={BOARD_CARDS_CLASSES}>
                  {Array.from({ length: FROST_CARDS[column] }, (_, card) => (
                    <FrostTile
                      key={card}
                      variant="row"
                      index={++cardIndex}
                      testId="tasks-board-frost-card"
                      className={cn(TASK_CARD_CLASSES, TASK_CARD_SHADOW)}
                    >
                      <div className={`${TASK_CARD_TITLE_TEXT} h-lh`} />
                      <div
                        className={`${TASK_CARD_LEGEND_CLASSES} ${TASK_CARD_LEGEND_TEXT}`}
                      >
                        <div className="h-lh" />
                      </div>
                    </FrostTile>
                  ))}
                </div>
              )}
            </FrostTile>
          );
        })}
      </div>
    </div>
  );
}
