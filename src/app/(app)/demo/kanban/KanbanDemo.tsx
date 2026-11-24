"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Démo du kanban (BRAIN-46) : tâches fictives en mémoire, « serveur » simulé (latence, échec à la demande).
// Mise à jour optimiste, exception limitée au déplacement (demo-plan.md) : la carte reste où elle est lâchée ;
// les enregistrements partent l'un après l'autre, dans l'ordre des dépôts. Affiché = enregistré + déplacements
// en attente rejoués par-dessus. Échec : le déplacement sort de l'attente, la carte revient à sa place, animée
// depuis l'endroit du dépôt (FLIP, `animate` de Motion sur `transform`, ADR-006 ; rien en mouvement réduit),
// puis bulle « Déplacement non enregistré. » avec Réessayer, au-dessus de la barre d'onglets (pouce).
// Échec d'un dépôt déjà dépassé par un dépôt plus récent de la même carte : ni retour ni bulle.
// Terminée : 20 plus récentes + « Tout voir », plus les cartes déposées pendant la visite. Annulée : bandeau replié avec compteur, cible de dépôt.
// Tap, clic ou Entrée sur une carte (`onOpen` du tableau) : détail de la carte (`KanbanDemoDetail`). Ses
// modifications restent en mémoire, par carte ; un changement de statut est un déplacement (en tête de colonne).
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  type BoardColumn,
  type BoardMove,
  SortableBoard,
} from "@/components/kanban/SortableBoard";

import {
  applyMove,
  DEMO_STATUSES,
  type DemoStatus,
  DONE_VISIBLE,
  simulateSave,
  statusMove,
  statusOf,
} from "./demo-board";
import { demoBoard, type DemoTask, demoTasks } from "./demo-fixtures";
import { KanbanDemoCard } from "./KanbanDemoCard";
import { type DemoEdit, KanbanDemoDetail } from "./KanbanDemoDetail";
import { KanbanDemoSettings, type Latency } from "./KanbanDemoSettings";

type PendingMove = { key: number; move: BoardMove };
type Origin = { id: string; left: number; top: number };

// Ressort sans rebond de DESIGN.md § 7 (apparition / retrait d'un élément de liste), bulle et retour de carte.
const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;
// Bulle d'échec effacée au geste suivant ou après 5 s (DESIGN.md § 5, **Boutons**).
const FAILURE_NOTICE_MS = 5000;

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
  const [saved, setSaved] = useState(() => demoBoard(tasks));
  const [pending, setPending] = useState<PendingMove[]>([]);
  const [failure, setFailure] = useState<BoardMove | null>(null);
  const [latency, setLatency] = useState<Latency>(0);
  const [failNext, setFailNext] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextKey = useRef(0);
  const returning = useRef<Origin | null>(null);
  // Dernier dépôt de chaque carte : l'échec d'un dépôt plus ancien est dépassé, rien à ramener ni à réessayer.
  const latestMove = useRef(new Map<string, number>());
  // Cartes déposées dans cette visite : toujours affichées, même au-delà des 20 de Terminée.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());

  const board = pending.reduce(
    (current, { move }) => applyMove(current, move),
    saved,
  );

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

  function changeStatus(id: string, status: DemoStatus) {
    const next = statusMove(board, id, status);
    if (next !== null) move(next);
  }

  const openStatus = openId === null ? undefined : statusOf(board, openId);

  // Retour d'une carte après un échec : elle part de l'endroit du dépôt, relevé avant le rendu.
  useLayoutEffect(() => {
    const origin = returning.current;
    if (origin === null) return;
    returning.current = null;
    const element = cardElement(origin.id);
    if (reducedMotion || element === null) return;
    const to = element.getBoundingClientRect();
    const x = origin.left - to.left;
    const y = origin.top - to.top;
    if (x === 0 && y === 0) return;
    animate(element, { x: [x, 0], y: [y, 0] }, SPRING);
  });

  useEffect(() => {
    if (failure === null) return;
    const timer = setTimeout(() => setFailure(null), FAILURE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [failure]);

  function move(next: BoardMove) {
    const key = nextKey.current++;
    const fail = failNext;
    const latencyMs = latency;
    latestMove.current.set(next.id, key);
    setFailNext(false);
    setFailure(null);
    setDropped((current) => new Set(current).add(next.id));
    setPending((current) => [...current, { key, move: next }]);
    queue.current = queue.current.then(async () => {
      const ok = await simulateSave({ latencyMs, fail });
      if (ok) {
        setSaved((current) => applyMove(current, next));
      } else if (latestMove.current.get(next.id) === key) {
        // Carte absente (colonne d'un autre onglet) : retour sans animation.
        const rect = cardElement(next.id)?.getBoundingClientRect();
        returning.current = rect
          ? { id: next.id, left: rect.left, top: rect.top }
          : null;
        setFailure(next);
      }
      setPending((current) => current.filter((entry) => entry.key !== key));
    });
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
      collapsed: status === "canceled",
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
        pendingCount={pending.length}
      />
      <div aria-busy={pending.length > 0}>
        <SortableBoard
          columns={columns}
          getItemLabel={(task) => task.title}
          onMove={move}
          onOpen={setOpenId}
          renderCard={(task, state) => (
            <KanbanDemoCard task={task} today={today} state={state} />
          )}
        />
      </div>
      {openId !== null && openStatus !== undefined && (
        <KanbanDemoDetail
          key={openId}
          task={shownTask(openId, openStatus)}
          today={today}
          knownTags={knownTags}
          onStatusChange={(status) => changeStatus(openId, status)}
          onEdit={(change) => edit(openId, change)}
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
                onClick={() => move(failure)}
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
