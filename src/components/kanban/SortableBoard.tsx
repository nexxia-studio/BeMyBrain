"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Tableau à colonnes ordonnées et glisser-déposer, générique (aucune notion de tâche). Seul fichier du dépôt
// qui importe dnd-kit (verrou eslint `sortableBoardImports`) : les sous-composants qui appellent ses hooks
// (carte, colonne, onglet) vivent donc ici, par exception à « un composant par fichier ».
// Mobile d'abord (ADR-008), mise en page choisie par la largeur, en CSS seulement (même balisage au serveur et
// au client : ni avertissement d'hydratation, ni saut au chargement) : sous 768 px, une colonne à la fois sous
// une rangée d'onglets, chaque onglet est une cible de dépôt ; au-delà, colonnes côte à côte en défilement
// horizontal. Une colonne masquée (`display: none`) a un rectangle vide : elle est retirée des cibles, à la
// souris, au doigt et au clavier. Seuls les rôles ARIA des onglets suivent la largeur en JS (`useMediaQuery`,
// rendu serveur en onglets, corrigé après l'hydratation sans rien changer à l'écran).
// Défilement horizontal sans aimant (`scroll-snap`) : le défilement automatique de dnd-kit avance par petits
// `scrollBy`, que l'aimant transforme chacun en saut d'une colonne entière (le tableau s'emballait jusqu'au bout,
// la colonne d'origine sortait de l'écran ; mesuré dans Chromium et WebKit, D4 de demo-plan.md).
// Glisser : souris après 4 px, doigt après un appui de 250 ms (le défilement reste libre avant), clavier
// (Espace, ou Entrée sans `onOpen` ; flèches, Échap). Défilement automatique près des bords (défaut de dnd-kit).
// Ouvrir (`onOpen`, facultatif) : un tap ou un clic n'ouvre la carte que si le doigt ou la souris se relève
// avant toute activation du glisser (doigt : moins de 250 ms ; les deux : sans dépasser la tolérance du capteur,
// 6 px au doigt, 4 px à la souris), sans défilement entre-temps (`scroll`, ou `pointercancel` quand le
// navigateur reprend le geste). Le geste est suivi par les événements pointeur, à côté des capteurs de dnd-kit,
// et jugé au `click` que le navigateur émet ensuite : le `click` qui suit un glisser ou un appui long est ignoré.
// Un `click` sans geste pointeur (`detail` 0, ou aucun pointeur posé : lecteur d'écran) ouvre. Clavier : Entrée
// ouvre, Espace saisit (Entrée ne saisit plus ; elle dépose toujours une carte saisie).
// Une colonne repliée ou un onglet reçoit la carte en tête de colonne.
// Colonne partielle (ex. 20 plus récentes) : `total` donne le compteur, `footer` se pose sous les cartes.
// Onglets : motif ARIA tablist (flèches gauche/droite en boucle, Début/Fin, seul l'onglet choisi est tabulable).
// Pendant le glisser, l'ordre est un brouillon local ; au dépôt, `onMove` reçoit les voisins de la carte et le
// brouillon est effacé : le parent met ses colonnes à jour dans le même événement (optimiste) pour que la carte
// reste où elle a été lâchée.
// Hydratation : `id` stable (`useId`) passé à DndContext, sinon le compteur de module de dnd-kit donne des
// `aria-describedby` différents entre serveur et client.
// Mouvement réduit : pas d'animation de dépôt ni de glissement des cartes voisines.
import {
  type Announcements,
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  KeyboardCode,
  type KeyboardCodes,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export type BoardItem = { id: string };

export type BoardColumn<T extends BoardItem> = {
  id: string;
  label: string;
  /** Dans l'ordre d'affichage. */
  items: readonly T[];
  /** Repliée : un bandeau avec libellé et compteur, qui reçoit les cartes en tête. */
  collapsed?: boolean;
  /** Nombre total quand `items` n'en montre qu'une partie (ex. 20 plus récentes) ; défaut : `items.length`. */
  total?: number;
  /** Sous les cartes d'une colonne ouverte (ex. « Tout voir »). */
  footer?: ReactNode;
};

export type BoardMove = {
  id: string;
  toColumn: string;
  /** Carte juste au-dessus de la carte déposée, `null` en tête de colonne. */
  beforeId: string | null;
  /** Carte juste en dessous, `null` en fin de colonne. */
  afterId: string | null;
};

export type CardState = { dragging: boolean; overlay: boolean };

type SortableBoardProps<T extends BoardItem> = {
  columns: readonly BoardColumn<T>[];
  renderCard: (item: T, state: CardState) => ReactNode;
  /** Nom de la carte dans les annonces du lecteur d'écran. */
  getItemLabel: (item: T) => string;
  onMove: (move: BoardMove) => void;
  /** Tap, clic ou Entrée sur une carte (jamais après un glisser, un appui long ou un défilement). */
  onOpen?: (id: string) => void;
};

/** Appui avant le glisser au doigt (décision d'Antoine après l'essai iPhone, 2026-11-24). */
const ACTIVATION_DELAY_MS = 250;
/** Tolérance du doigt avant la saisie, distance de la souris avant le glisser : au-delà, plus de tap. */
const TOUCH_TOLERANCE_PX = 6;
const MOUSE_DISTANCE_PX = 4;
/** Avec `onOpen`, Entrée ouvre la carte : seul Espace la saisit. */
const OPEN_KEYBOARD_CODES: KeyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter],
};
/** Largeur des colonnes côte à côte : `md` de Tailwind. */
const WIDE_QUERY = "(min-width: 48rem)";

type Layout = Record<string, string[]>;
type DropKind = "column" | "zone";
type DropData = { kind: DropKind; columnId: string };
type Target = { columnId: string; index: number; kind: DropKind | "item" };

// Identifiants des cibles qui ne sont pas des cartes (les cartes gardent leur propre id).
const columnDropId = (id: string) => `column:${id}`;
const zoneDropId = (id: string, where: "tab" | "band") => `${where}:${id}`;

function layoutOf<T extends BoardItem>(
  columns: readonly BoardColumn<T>[],
): Layout {
  return Object.fromEntries(
    columns.map((column) => [column.id, column.items.map((item) => item.id)]),
  );
}

// Compteur affiché : le total de la colonne, corrigé des cartes entrées ou sorties pendant le glisser.
function countOf<T extends BoardItem>(column: BoardColumn<T>, ids: string[]) {
  return (
    (column.total ?? column.items.length) + ids.length - column.items.length
  );
}

function columnOf(layout: Layout, id: UniqueIdentifier) {
  return Object.keys(layout).find((columnId) =>
    layout[columnId].includes(String(id)),
  );
}

function targetOf(
  layout: Layout,
  over: { id: UniqueIdentifier; data: { current?: unknown } } | null,
): Target | null {
  if (!over) return null;
  const data = over.data.current as Partial<DropData> | undefined;
  if (data?.kind === "zone" && data.columnId) {
    return { columnId: data.columnId, index: 0, kind: "zone" };
  }
  if (data?.kind === "column" && data.columnId) {
    const length = layout[data.columnId]?.length ?? 0;
    return { columnId: data.columnId, index: length, kind: "column" };
  }
  const columnId = columnOf(layout, over.id);
  if (!columnId) return null;
  return {
    columnId,
    index: layout[columnId].indexOf(String(over.id)),
    kind: "item",
  };
}

function moveTo(layout: Layout, id: string, target: Target): Layout {
  const from = columnOf(layout, id);
  if (!from) return layout;
  if (from === target.columnId) {
    const list = layout[from];
    const to = Math.min(target.index, list.length - 1);
    return { ...layout, [from]: arrayMove(list, list.indexOf(id), to) };
  }
  const destination = [...layout[target.columnId]];
  destination.splice(target.index, 0, id);
  return {
    ...layout,
    [from]: layout[from].filter((itemId) => itemId !== id),
    [target.columnId]: destination,
  };
}

// Cibles affichées seulement : une cible masquée par la mise en page (onglets au-delà de 768 px, colonnes non
// choisies en deçà) a un rectangle vide en haut à gauche, qui attirerait les coins les plus proches. Sans
// rectangle, dnd-kit ignore la cible (détection de collision et déplacement au clavier).
function shownRects<R extends { width: number; height: number }>(
  rects: Map<UniqueIdentifier, R>,
): Map<UniqueIdentifier, R> {
  return new Map(
    [...rects].filter(([, rect]) => rect.width > 0 || rect.height > 0),
  );
}

// Une cible de dépôt sous le pointeur (onglet, bandeau) l'emporte ; sinon coins les plus proches, adapté aux
// listes en colonnes (et seul calcul possible au clavier, sans pointeur).
const collisionDetection: CollisionDetection = (all) => {
  const args = { ...all, droppableRects: shownRects(all.droppableRects) };
  const zone = pointerWithin(args).find(
    (collision) =>
      (
        collision.data?.droppableContainer?.data.current as
          Partial<DropData> | undefined
      )?.kind === "zone",
  );
  return zone ? [zone] : closestCorners(args);
};

const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) =>
  sortableKeyboardCoordinates(event, {
    ...args,
    context: {
      ...args.context,
      droppableRects: shownRects(args.context.droppableRects),
    },
  });

export function SortableBoard<T extends BoardItem>({
  columns,
  renderCard,
  getItemLabel,
  onMove,
  onOpen,
}: SortableBoardProps<T>) {
  const t = useTranslations("kanban");
  const contextId = useId();
  const tabsId = useId();
  const reducedMotion = useReducedMotion() ?? false;
  const wide = useMediaQuery(WIDE_QUERY);
  const [draft, setDraft] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chosenColumnId, setChosenColumnId] = useState(columns[0]?.id);
  // Colonne choisie retirée par le parent : retour à la première.
  const shownColumnId = columns.some((column) => column.id === chosenColumnId)
    ? chosenColumnId
    : columns[0]?.id;

  const current = draft ?? layoutOf(columns);

  const itemsById = useMemo(
    () =>
      new Map(
        columns.flatMap((column) =>
          column.items.map((item) => [item.id, item] as const),
        ),
      ),
    [columns],
  );
  const labelOfColumn = (id: string) =>
    columns.find((column) => column.id === id)?.label ?? "";
  const labelOfItem = (id: UniqueIdentifier) => {
    const item = itemsById.get(String(id));
    return item ? getItemLabel(item) : "";
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: MOUSE_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: ACTIVATION_DELAY_MS,
        tolerance: TOUCH_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      ...(onOpen ? { keyboardCodes: OPEN_KEYBOARD_CODES } : {}),
    }),
  );

  function describe(
    key: "picked" | "over" | "dropped",
    columnKey: "overColumn" | "droppedColumn",
    itemId: UniqueIdentifier,
    target: Target | null,
  ) {
    const item = labelOfItem(itemId);
    if (!target) return t("overNone", { item });
    const column = labelOfColumn(target.columnId);
    if (target.kind !== "item") return t(columnKey, { item, column });
    return t(key, {
      item,
      column,
      position: target.index + 1,
      count: current[target.columnId].length,
    });
  }

  function isAtOrigin(id: UniqueIdentifier) {
    const original = layoutOf(columns);
    const from = columnOf(original, id);
    return (
      from !== undefined &&
      current[from]?.indexOf(String(id)) === original[from].indexOf(String(id))
    );
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      describe("picked", "overColumn", active.id, targetOf(current, active)),
    // Au départ, la carte est au-dessus d'elle-même : on garde l'annonce « saisie ».
    onDragOver: ({ active, over }) =>
      over?.id === active.id && isAtOrigin(active.id)
        ? undefined
        : describe("over", "overColumn", active.id, targetOf(current, over)),
    onDragEnd: ({ active, over }) =>
      describe("dropped", "droppedColumn", active.id, targetOf(current, over)),
    onDragCancel: ({ active }) =>
      t("cancelled", { item: labelOfItem(active.id) }),
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDraft(layoutOf(columns));
  }

  // Changement de colonne en survol d'une carte ou d'une colonne ouverte : la carte y prend place tout de
  // suite. Onglets et bandeaux ne bougent rien avant le dépôt (leur colonne n'est pas affichée).
  function handleDragOver({ active, over }: DragOverEvent) {
    const target = targetOf(current, over);
    if (!target || target.kind === "zone") return;
    if (columnOf(current, active.id) === target.columnId) return;
    setDraft(moveTo(current, String(active.id), target));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const target = targetOf(current, over);
    setActiveId(null);
    setDraft(null);
    if (!target) return;
    const final = moveTo(current, id, target);
    const list = final[target.columnId];
    const index = list.indexOf(id);
    const original = layoutOf(columns);
    const from = columnOf(original, id);
    if (from === target.columnId && original[from].indexOf(id) === index) {
      return;
    }
    onMove({
      id,
      toColumn: target.columnId,
      beforeId: list[index - 1] ?? null,
      afterId: list[index + 1] ?? null,
    });
  }

  function handleDragCancel() {
    setActiveId(null);
    setDraft(null);
  }

  // Motif ARIA des onglets : flèches gauche/droite en boucle, Début/Fin ; l'onglet atteint est choisi.
  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const index = columns.findIndex((column) => column.id === shownColumnId);
    let next: number;
    if (step !== undefined) {
      next = (index + step + columns.length) % columns.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = columns.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setChosenColumnId(columns[next].id);
    event.currentTarget
      .querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  }

  const activeItem = activeId ? itemsById.get(activeId) : undefined;
  const panelId = (columnId: string) => `${tabsId}-panel-${columnId}`;

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: t(onOpen ? "instructionsOpen" : "instructions"),
        },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Onglets sous 768 px seulement ; au-delà, `display: none` les retire aussi des cibles et du lecteur d'écran. */}
      <div
        role="tablist"
        onKeyDown={handleTabKeyDown}
        aria-label={t("columns")}
        className="glass flex gap-1 overflow-x-auto rounded-full p-1 md:hidden"
      >
        {columns.map((column) => (
          <BoardTab
            key={column.id}
            columnId={column.id}
            label={column.label}
            count={countOf(column, current[column.id] ?? [])}
            selected={column.id === shownColumnId}
            panelId={panelId(column.id)}
            onSelect={() => setChosenColumnId(column.id)}
          />
        ))}
      </div>
      <div className="mt-grid flex flex-col md:mt-0 md:flex-row md:gap-grid md:overflow-x-auto md:pb-2">
        {columns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            itemIds={current[column.id] ?? []}
            itemsById={itemsById}
            renderCard={renderCard}
            reducedMotion={reducedMotion}
            roleDescription={t("roleDescription")}
            onOpen={onOpen}
            panelId={wide ? undefined : panelId(column.id)}
            className={cn(
              "md:w-80 md:shrink-0",
              column.id !== shownColumnId && "hidden md:flex",
            )}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
        {activeItem ? (
          <div data-board-overlay className="cursor-grabbing">
            {renderCard(activeItem, { dragging: true, overlay: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type BoardColumnViewProps<T extends BoardItem> = {
  column: BoardColumn<T>;
  itemIds: string[];
  itemsById: Map<string, T>;
  renderCard: (item: T, state: CardState) => ReactNode;
  reducedMotion: boolean;
  roleDescription: string;
  onOpen: ((id: string) => void) | undefined;
  /** Sous 768 px, la colonne est le panneau de son onglet. */
  panelId: string | undefined;
  className: string;
};

function BoardColumnView<T extends BoardItem>({
  column,
  itemIds,
  itemsById,
  renderCard,
  reducedMotion,
  roleDescription,
  onOpen,
  panelId,
  className,
}: BoardColumnViewProps<T>) {
  const headingId = useId();
  const collapsed = column.collapsed ?? false;
  const { setNodeRef, isOver } = useDroppable({
    id: collapsed ? zoneDropId(column.id, "band") : columnDropId(column.id),
    data: {
      kind: collapsed ? "zone" : "column",
      columnId: column.id,
    } satisfies DropData,
    // Colonne ouverte : cible seulement vide, sinon ce sont ses cartes. Active, elle serait au clavier la plus
    // proche au-dessus de la première carte (flèche haut = renvoi en fin de colonne) et masquerait les onglets.
    disabled: !collapsed && itemIds.length > 0,
  });

  return (
    <section
      ref={setNodeRef}
      id={panelId}
      role={panelId ? "tabpanel" : undefined}
      aria-labelledby={headingId}
      data-board-column={column.id}
      className={cn(
        "glass flex flex-col gap-2 rounded-tile p-tile",
        isOver && "outline-2 outline-ring",
        className,
      )}
    >
      <h2
        id={headingId}
        className="flex min-h-11 items-center justify-between gap-2 text-eyebrow text-muted-foreground uppercase"
      >
        <span>{column.label}</span>
        <span className="tabular-nums">{countOf(column, itemIds)}</span>
      </h2>
      {collapsed ? null : (
        <SortableContext
          id={column.id}
          items={itemIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex min-h-11 flex-col gap-2">
            {itemIds.map((id) => {
              const item = itemsById.get(id);
              return item ? (
                <SortableCard
                  key={id}
                  id={id}
                  reducedMotion={reducedMotion}
                  roleDescription={roleDescription}
                  onOpen={onOpen}
                >
                  {(dragging) => renderCard(item, { dragging, overlay: false })}
                </SortableCard>
              ) : null;
            })}
          </div>
        </SortableContext>
      )}
      {collapsed ? null : column.footer}
    </section>
  );
}

type SortableCardProps = {
  id: string;
  reducedMotion: boolean;
  roleDescription: string;
  onOpen: ((id: string) => void) | undefined;
  children: (dragging: boolean) => ReactNode;
};

/** Geste pointeur en cours sur une carte : `spoiled` dès qu'il ne peut plus être un tap. */
type Gesture = { spoiled: boolean; stop: () => void };

/**
 * Suit un geste pointeur depuis la carte jusqu'au relâchement : mouvement au-delà de la tolérance, appui long
 * (doigt), défilement ou geste repris par le navigateur le gâchent. Écoute sur `window` : le pointeur peut
 * quitter la carte (calque du glisser, défilement).
 */
function trackGesture(event: PointerEvent<HTMLElement>): Gesture {
  const touch = event.pointerType === "touch";
  const limit = touch ? TOUCH_TOLERANCE_PX : MOUSE_DISTANCE_PX;
  const { clientX: x, clientY: y } = event;
  const spoil = () => {
    gesture.spoiled = true;
  };
  const onMove = (move: globalThis.PointerEvent) => {
    if (Math.hypot(move.clientX - x, move.clientY - y) > limit) spoil();
  };
  const timer = touch ? setTimeout(spoil, ACTIVATION_DELAY_MS) : undefined;
  const stop = () => {
    clearTimeout(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointercancel", onCancel);
    window.removeEventListener("pointerup", stop);
    window.removeEventListener("scroll", spoil, true);
  };
  const onCancel = () => {
    spoil();
    stop();
  };
  const gesture: Gesture = { spoiled: false, stop };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("pointerup", stop);
  // Capture : le défilement d'un conteneur (tableau, page) ne remonte pas jusqu'à `window`.
  window.addEventListener("scroll", spoil, true);
  return gesture;
}

function SortableCard({
  id,
  reducedMotion,
  roleDescription,
  onOpen,
  children,
}: SortableCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, attributes: { roleDescription } });
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => () => gesture.current?.stop(), []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!onOpen || !event.isPrimary || event.button !== 0) return;
    gesture.current?.stop();
    gesture.current = trackGesture(event);
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!onOpen) return;
    const last = gesture.current;
    gesture.current = null;
    // `detail` 0 : activation sans pointeur (lecteur d'écran). Sans geste suivi non plus.
    if (event.detail === 0 || last === null || !last.spoiled) onOpen(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (onOpen && event.key === "Enter" && !isDragging && !event.repeat) {
      event.preventDefault();
      onOpen(id);
      return;
    }
    listeners?.onKeyDown?.(event);
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      data-board-card={id}
      // Appui long sur iOS : pas de menu d'aperçu ni de sélection de texte, le glisser prend le relais.
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reducedMotion ? undefined : transition,
        WebkitTouchCallout: "none",
      }}
      className={cn(
        "cursor-grab touch-manipulation rounded-lg select-none",
        isDragging && "opacity-40",
      )}
    >
      {children(isDragging)}
    </div>
  );
}

type BoardTabProps = {
  columnId: string;
  label: string;
  count: number;
  selected: boolean;
  panelId: string;
  onSelect: () => void;
};

function BoardTab({
  columnId,
  label,
  count,
  selected,
  panelId,
  onSelect,
}: BoardTabProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneDropId(columnId, "tab"),
    data: { kind: "zone", columnId } satisfies DropData,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-controls={selected ? panelId : undefined}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-small font-semibold",
        selected
          ? "bg-pill-active text-foreground shadow-raised"
          : "text-muted-foreground",
        isOver && "outline-2 outline-ring",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
