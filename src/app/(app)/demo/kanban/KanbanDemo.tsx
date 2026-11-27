"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Démo du kanban (BRAIN-46) : tâches fictives en mémoire, « serveur » simulé (latence, échec à la demande).
// Mise à jour optimiste, exception limitée au déplacement (demo-plan.md) : file de `useBoardMoves` (la carte
// reste où elle est lâchée, enregistrements en série, échec dépassé ignoré). Échec : la carte revient à sa place,
// animée depuis l'endroit du dépôt (FLIP, `animate` de Motion sur `transform`, ADR-006 ; rien en mouvement
// réduit), puis bulle « Déplacement non enregistré. » avec Réessayer, au-dessus de la barre d'onglets (pouce).
// Terminée : 20 plus récentes + « Tout voir », plus les cartes déposées pendant la visite. Annulée : colonne repliable
// (tâche 15), repliée au départ en bandeau étroit avec compteur, cible de dépôt ; l'état replié est tenu ici, en
// mémoire (le cookie vient avec le vrai tableau). Sous 768 px, un onglet comme les autres.
// Tap, clic ou Entrée sur une carte (`onOpen` du tableau) : détail de la carte (`KanbanDemoDetail`). Ses
// modifications restent en mémoire, par carte ; un changement de statut est un déplacement (en tête de colonne).
// Sélecteur « Détail » (D9), dans la fenêtre du détail : nouvel ordre (défaut) ou ordre d'avant, à comparer sur
// place ; le choix est tenu ici, gardé d'une carte à l'autre.
// Surfaces : variante « Creux » retenue (D7, décision d'Antoine du 2026-11-25), fixée par `SortableBoard`.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useState } from "react";

import {
  type BoardColumn,
  type BoardMove,
  SortableBoard,
} from "@/components/kanban/SortableBoard";
import { useBoardMoves } from "@/components/kanban/use-board-moves";

import {
  DEMO_STATUSES,
  type DemoStatus,
  DONE_VISIBLE,
  simulateSave,
  statusMove,
  statusOf,
} from "./demo-board";
import { demoBoard, type DemoTask, demoTasks } from "./demo-fixtures";
import { KanbanDemoCard } from "./KanbanDemoCard";
import {
  type DemoDetailLayout,
  type DemoEdit,
  KanbanDemoDetail,
} from "./KanbanDemoDetail";
import { KanbanDemoSettings, type Latency } from "./KanbanDemoSettings";

// Ressort sans rebond de DESIGN.md § 7 (apparition / retrait d'un élément de liste), bulle et retour de carte.
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;

function cardElement(id: string) {
  return document.querySelector<HTMLElement>(`[data-demo-card="${id}"]`);
}

type KanbanDemoProps = {
  /** `YYYY-MM-DD`, jour de l'utilisateur, calculé par la page serveur. */
  today: string;
};

export function KanbanDemo({ today }: KanbanDemoProps) {
  const t = useTranslations("kanbanDemo");
  const tStatus = useTranslations("tasks.detail.status");
  const reducedMotion = useReducedMotion() ?? false;
  const tasks = useMemo(() => demoTasks(today), [today]);
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  // Tags proposés par le détail : ceux de toutes les cartes, sans doublon.
  const knownTags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags))],
    [tasks],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Readonly<Record<string, DemoEdit>>>({});
  const initialBoard = useMemo(() => demoBoard(tasks), [tasks]);
  const [latency, setLatency] = useState<Latency>(0);
  const [failNext, setFailNext] = useState(false);
  const [detailLayout, setDetailLayout] = useState<DemoDetailLayout>("new");
  const [showAllDone, setShowAllDone] = useState(false);
  const [canceledCollapsed, setCanceledCollapsed] = useState(true);
  // Cartes déposées dans cette visite : toujours affichées, même au-delà des 20 de Terminée.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  // Latence et échec du rendu où la carte est déposée : le hook garde l'enregistrement de ce rendu.
  const moves = useBoardMoves({
    saved: initialBoard,
    save: () => simulateSave({ latencyMs: latency, fail: failNext }),
    reducedMotion,
    cardElement,
    // L'enregistrement simulé ne lève jamais ; si la file remet quand même une erreur, elle est dite.
    onSaveError: (error) => console.error("[demo] dépôt en échec", error),
  });
  const { board, failure, pendingCount } = moves;

  /** Carte telle qu'affichée : tâche fictive, modifications du détail, statut de sa colonne. */
  function shownTask(id: string, status: DemoStatus): DemoTask {
    return { ...tasksById.get(id)!, ...edits[id], status };
  }

  function edit(id: string, change: DemoEdit) {
    setEdits((current) => ({
      ...current,
      [id]: { ...current[id], ...change },
    }));
  }

  // Ajout à partir de l'état courant, pas de la carte rendue : deux Entrées rapprochées n'écrasent rien
  // (l'ajout part dans une transition du champ, le rendu suivant peut ne pas être arrivé).
  function addSubtask(id: string, title: string) {
    setEdits((current) => {
      const subtasks = current[id]?.subtasks ?? tasksById.get(id)!.subtasks;
      return {
        ...current,
        [id]: {
          ...current[id],
          subtasks: [
            ...subtasks,
            // Aucun retrait dans la démo : le rang suffit à l'unicité.
            { id: `${id}.${subtasks.length + 1}`, title, done: false },
          ],
        },
      };
    });
  }

  function changeStatus(id: string, status: DemoStatus) {
    const next = statusMove(board, id, status);
    if (next !== null) move(next);
  }

  const openStatus = openId === null ? undefined : statusOf(board, openId);

  // Retour d'une carte après un échec : elle part de l'endroit du dépôt, relevé par le hook avant le rendu.
  useLayoutEffect(() => {
    const back = moves.consumeReturn();
    if (back === null) return;
    animate(back.element, { x: [back.x, 0], y: [back.y, 0] }, SPRING);
  });

  function move(next: BoardMove) {
    setFailNext(false);
    setDropped((current) => new Set(current).add(next.id));
    moves.move(next);
  }

  function retry() {
    setFailNext(false);
    if (failure !== null) moves.move(failure);
  }

  const columns: BoardColumn<DemoTask>[] = DEMO_STATUSES.map((status) => {
    const ids = board[status];
    const limited = status === "completed" && ids.length > DONE_VISIBLE;
    const shown =
      limited && !showAllDone
        ? ids.filter((id, index) => index < DONE_VISIBLE || dropped.has(id))
        : ids;
    return {
      id: status,
      label: tStatus(status),
      // Le statut suit la colonne : une carte déposée dans Terminée n'est plus en retard.
      items: shown.map((id) => shownTask(id, status)),
      collapsible: status === "canceled",
      collapsed: status === "canceled" && canceledCollapsed,
      total: ids.length,
      footer: limited ? (
        <button
          type="button"
          onClick={() => setShowAllDone((current) => !current)}
          className="flex min-h-11 items-center self-start rounded-lg text-small font-semibold text-link hover:text-link-hover"
        >
          {showAllDone
            ? t("seeLess", { count: DONE_VISIBLE })
            : t("seeAll", { count: ids.length })}
        </button>
      ) : undefined,
    };
  });

  return (
    <>
      <KanbanDemoSettings
        latency={latency}
        onLatencyChange={setLatency}
        failNext={failNext}
        onFailNextChange={setFailNext}
        pendingCount={pendingCount}
      />
      <div aria-busy={pendingCount > 0}>
        <SortableBoard
          columns={columns}
          getItemLabel={(task) => task.title}
          onMove={move}
          onOpen={setOpenId}
          onCollapsedChange={(_columnId, collapsed) =>
            setCanceledCollapsed(collapsed)
          }
          renderCard={(task, state) => (
            <KanbanDemoCard task={task} today={today} state={state} />
          )}
        />
      </div>
      {openId !== null && openStatus !== undefined && (
        <KanbanDemoDetail
          key={openId}
          layout={detailLayout}
          onLayoutChange={setDetailLayout}
          task={shownTask(openId, openStatus)}
          today={today}
          knownTags={knownTags}
          onStatusChange={(status) => changeStatus(openId, status)}
          onEdit={(change) => edit(openId, change)}
          onAddSubtask={(title) => addSubtask(openId, title)}
          onClose={() => setOpenId(null)}
        />
      )}
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
                onClick={retry}
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
