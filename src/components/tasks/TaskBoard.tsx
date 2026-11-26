"use client";

// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Tableau de `/tasks` (spec todo-kanban, « Tableau ») : une colonne par catégorie de statut, cartes `TaskCard`,
// glisser de `SortableBoard`. Repli sous 768 px : une colonne à la fois sous une rangée d'onglets (`SortableBoard`).
// Aucune lecture ici : colonnes, totaux et préférences arrivent de la page serveur.
//
// Déplacement, seule mise à jour optimiste de la to-do (file de `useBoardMoves`, lire son en-tête) :
// - `saved` vient des seules props du serveur, sous `useMemo` ; jamais d'un état optimiste ;
// - le déplacement remis à la file est celui que le serveur appliquera : vers Terminée ou Annulée la position est
//   ignorée, la carte va en tête (sans voisines) ; l'affichage optimiste et le tableau du serveur coïncident ;
// - dépôt dans sa propre colonne Terminée ou Annulée : rien n'est enregistré ni affiché (le serveur rendrait le
//   même tableau, la file garderait un dépôt confirmé jamais retiré) ;
// - chaque réussite est suivie d'un rendu serveur : `runAppAction` rafraîchit la route après toute écriture
//   (`refresh()` de `web-action.ts`), aucun `router.refresh()` ici ;
// - échec (refus du serveur ou panne) : la carte revient, animée depuis l'endroit du dépôt (`animate` de Motion
//   sur `transform`, ADR-006 ; rien en mouvement réduit), et la bulle propose de réessayer ;
// - session expirée : `settleAction` relance le renvoi vers `/login`, la file le remet à `onSaveError`, et il est
//   relancé ici au rendu, là où la frontière de Next le reçoit et navigue (docs/gotchas.md, « Action refusée sans
//   session ») ; le tableau est alors démonté, sans bulle.
// Changement de périmètre avec des dépôts en attente (règle retenue) : ils partent quand même, dans l'ordre.
// Option ou filtre d'espace basculé, côté changé : même tableau monté, les dépôts en attente sont rejoués sur le
// nouveau tableau du serveur (carte absente du nouveau périmètre : plus affichée, échec muet). Vue Liste choisie :
// le tableau est démonté, la file finit ses enregistrements sans rien afficher.
//
// Terminée et Annulée : 20 cartes lues, « Tout voir » par l'adresse (lien donné par la page). Une carte déposée
// pendant la visite reste visible au-delà des 20 : seul cas réel, une carte passée de Terminée à Annulée (ou
// l'inverse) garde sa date de clôture, que le serveur peut ranger hors des 20 plus récentes.
// raccourci: cette carte gardée est rendue de mémoire (dernier état lu), en fin de colonne, tant que le serveur
// dit la colonne tronquée ; elle est oubliée dès qu'on l'ouvre (une mise à la corbeille depuis le détail ne
// laisserait pas de carte fantôme) et hors du périmètre où elle a été déposée — à remplacer par une lecture
// serveur des cartes déposées si le cas se montre à l'usage.
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useState } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { type BoardIds, boardHas } from "@/components/kanban/board-moves";
import {
  type BoardColumn as ShownColumn,
  type BoardMove,
  SortableBoard,
} from "@/components/kanban/SortableBoard";
import { useBoardMoves } from "@/components/kanban/use-board-moves";
import { TASKS_PATH } from "@/components/shell/nav-items";
import { PreferenceStatus } from "@/components/shell/PreferenceStatus";
import { useOptimisticPreference } from "@/components/shell/use-optimistic-preference";
import { setBoardOption } from "@/lib/preferences-actions";
import { settleAction } from "@/lib/settle-action";
import type { BoardColumn, Task } from "@/modules/tasks/queries";
import {
  BOARD_CLOSED_DEFAULT_LIMIT,
  type StatusCategory,
  TASK_LIST_MAX_LIMIT,
} from "@/modules/tasks/sides";

import { TaskCard } from "./TaskCard";

// Ressort sans rebond de DESIGN.md § 7 (apparition / retrait d'un élément de liste), bulle et retour de carte.
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

type ClosedCategory = "completed" | "canceled";

function isClosed(category: string): category is ClosedCategory {
  return category === "completed" || category === "canceled";
}

/** Carte en place (pas le calque du glisser), `null` si elle n'est pas rendue ; ne lève jamais. */
function cardElement(id: string) {
  return document.querySelector<HTMLElement>(`[data-task-card="${id}"]`);
}

const saveCanceledOpen = (next: boolean) =>
  setBoardOption("canceledOpen", next);

/** Enregistre un déplacement par le registre : vrai seulement si l'action a réussi (un refus est un échec). */
async function save(move: BoardMove): Promise<boolean> {
  const outcome = await settleAction(() =>
    runAppAction("tasks.move", {
      taskId: move.id,
      statusCategory: move.toColumn,
      ...(move.beforeId !== null && { beforeId: move.beforeId }),
      ...(move.afterId !== null && { afterId: move.afterId }),
    }),
  );
  return outcome.ok && outcome.value.ok;
}

/** Carte déposée dans une colonne fermée pendant la visite : dernier état lu, périmètre du dépôt. */
type KeptCard = { column: ClosedCategory; task: Task; scopeKey: string };

/** « Tout voir » d'une colonne fermée : état lu dans l'adresse et lien vers l'état inverse. */
export type SeeAll = { expanded: boolean; href: string };

type TaskBoardProps = {
  /** Colonnes lues par le serveur (`loadBoard`), dans l'ordre des catégories. */
  columns: readonly BoardColumn[];
  /** `YYYY-MM-DD`, jour de l'utilisateur. */
  today: string;
  /** Pastille d'espace sur les cartes : même règle que la liste (`showContextChip`). */
  showContext: boolean;
  /** Requête de la page gardée par le lien du détail (`?done=all`…). */
  listQuery: string;
  /** Colonne Annulée dépliée (cookie bmb_board_canceled_open, lu par le serveur). */
  canceledOpen: boolean;
  seeAll: Record<ClosedCategory, SeeAll>;
  /** Périmètre lu (côté, espace, options de sous-tâches) : une carte gardée de mémoire ne vaut que pour lui. */
  scopeKey: string;
};

export function TaskBoard({
  columns,
  today,
  showContext,
  listQuery,
  canceledOpen,
  seeAll,
  scopeKey,
}: TaskBoardProps) {
  const t = useTranslations("tasks.board");
  const tStatus = useTranslations("tasks.detail.status");
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const saved = useMemo(() => {
    const ids = {} as Record<StatusCategory, string[]>;
    for (const column of columns) {
      ids[column.category] = column.tasks.map((task) => task.id);
    }
    return ids as BoardIds<StatusCategory>;
  }, [columns]);
  const tasksById = useMemo(
    () =>
      new Map(
        columns.flatMap((column) =>
          column.tasks.map((task) => [task.id, task] as const),
        ),
      ),
    [columns],
  );
  const [kept, setKept] = useState<ReadonlyMap<string, KeptCard>>(new Map());
  const [controlError, setControlError] = useState<{ error: unknown } | null>(
    null,
  );
  const canceled = useOptimisticPreference(canceledOpen, saveCanceledOpen);
  const moves = useBoardMoves({
    saved,
    save,
    reducedMotion,
    cardElement,
    onSaveError,
  });
  const { board, failure, pendingCount } = moves;

  // Retour d'une carte après un échec : elle part de l'endroit du dépôt, relevé par la file avant le rendu.
  useLayoutEffect(() => {
    const back = moves.consumeReturn();
    if (back === null) return;
    animate(back.element, { x: [back.x, 0], y: [back.y, 0] }, SPRING);
  });

  // Erreur de contrôle de Next (renvoi vers /login) : relancée au rendu, où la frontière de Next l'attrape.
  if (controlError !== null) throw controlError.error;

  function onSaveError(error: unknown) {
    try {
      unstable_rethrow(error);
    } catch (control) {
      moves.dismissFailure();
      setControlError({ error: control });
      return;
    }
    // Panne inattendue de la file : libellé fixe et erreur seule, jamais la tâche (.claude/rules/sentry.md).
    console.error("[tasks] déplacement en échec", error);
  }

  function forget(id: string) {
    setKept((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  function move(next: BoardMove) {
    const to = next.toColumn;
    if (!isClosed(to)) {
      forget(next.id);
      moves.move(next);
      return;
    }
    // Déjà dans cette colonne fermée : la position y est ignorée, rien à enregistrer.
    if (board[to].includes(next.id) || kept.get(next.id)?.column === to) return;
    const task = tasksById.get(next.id) ?? kept.get(next.id)?.task;
    if (task !== undefined) {
      setKept((current) =>
        new Map(current).set(next.id, { column: to, task, scopeKey }),
      );
    }
    moves.move({ ...next, beforeId: null, afterId: null });
  }

  function open(id: string) {
    forget(id);
    router.push(`${TASKS_PATH}/${id}${listQuery}`, { scroll: false });
  }

  const shownColumns: ShownColumn<Task>[] = columns.map((column) => {
    const category = column.category;
    const closed = isClosed(category);
    const ids = board[category];
    const read = saved[category];
    // Total du serveur, corrigé des cartes arrivées et parties depuis sa lecture.
    const total =
      column.total +
      ids.filter((id) => !read.includes(id)).length -
      read.filter((id) => !ids.includes(id)).length;
    // Cartes gardées de mémoire : déposées ici, absentes du tableau du serveur, colonne dite tronquée.
    const remembered =
      closed && column.truncated
        ? [...kept]
            .filter(
              ([id, card]) =>
                card.column === category &&
                card.scopeKey === scopeKey &&
                !boardHas(board, id),
            )
            .map(([id]) => id)
        : [];
    const view = closed ? seeAll[category] : null;
    const seeAllShown = view !== null && total > BOARD_CLOSED_DEFAULT_LIMIT;
    // Plafond de lecture atteint : colonne ouverte, ou colonne fermée affichée en entier.
    const capped = column.truncated && (view === null || view.expanded);
    return {
      id: category,
      label: tStatus(category),
      // Le statut suit la colonne : une carte déposée dans Terminée n'est plus ni en retard ni bloquée.
      items: [...ids, ...remembered].flatMap((id) => {
        const task = tasksById.get(id) ?? kept.get(id)?.task;
        return task === undefined
          ? []
          : [
              {
                ...task,
                statusCategory: category,
                blocked: task.blocked && !closed,
              },
            ];
      }),
      collapsible: category === "canceled",
      collapsed: category === "canceled" && !canceled.shown,
      total,
      footer:
        seeAllShown || capped ? (
          <div className="flex flex-col gap-1">
            {capped && (
              <p className="px-1 text-caption text-foreground">
                {t("truncated", { count: TASK_LIST_MAX_LIMIT })}
              </p>
            )}
            {seeAllShown && (
              <Link
                href={view.href}
                replace
                scroll={false}
                className="flex min-h-11 items-center self-start rounded-lg px-1 text-small font-semibold text-link no-underline hover:text-link-hover"
              >
                {view.expanded
                  ? t("seeLess", { count: BOARD_CLOSED_DEFAULT_LIMIT })
                  : t("seeAll", { count: total })}
              </Link>
            )}
          </div>
        ) : undefined,
    };
  });

  return (
    <>
      <div className="relative" aria-busy={pendingCount > 0}>
        <SortableBoard
          columns={shownColumns}
          getItemLabel={(task) => task.title}
          onMove={move}
          onOpen={open}
          onCollapsedChange={(_columnId, collapsed) =>
            canceled.update(!collapsed)
          }
          renderCard={(task, state) => (
            <TaskCard
              task={task}
              today={today}
              showContext={showContext}
              state={state}
            />
          )}
        />
        <PreferenceStatus
          failed={canceled.failed}
          className="top-0 right-0 mt-2 mr-2"
        />
      </div>
      <div
        role="alert"
        className="pointer-events-none fixed inset-x-page bottom-tabbar-reserve z-(--z-toast) flex justify-center lg:inset-x-auto lg:right-page lg:bottom-page"
      >
        <AnimatePresence>
          {failure !== null && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={SPRING}
              className="pointer-events-auto flex min-h-11 max-w-md items-center gap-x-3 rounded-lg bg-popover py-1 pr-1.5 pl-4 text-small font-medium text-destructive shadow-glass"
            >
              <span className="py-2">{t("moveFailed")}</span>
              <motion.button
                type="button"
                onClick={moves.retry}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
                className="min-h-11 shrink-0 rounded-md px-3 text-small font-semibold text-link hover:text-link-hover"
              >
                {t("retry")}
              </motion.button>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
