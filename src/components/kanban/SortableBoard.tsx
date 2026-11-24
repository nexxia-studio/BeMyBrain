"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Tableau à colonnes ordonnées et glisser-déposer, générique (aucune notion de tâche). Seul fichier du dépôt
// qui importe dnd-kit (verrou eslint `sortableBoardImports`) : les sous-composants qui appellent ses hooks
// (carte, colonne, onglet) vivent donc ici, par exception à « un composant par fichier ».
// Mobile d'abord (ADR-008) : `scroll` = colonnes côte à côte en défilement horizontal aimanté, une colonne et
// demie visible à 390 px ; `tabs` = une colonne à la fois sous une rangée d'onglets, chaque onglet est une cible
// de dépôt. Au-delà de 768 px, `scroll` montre plusieurs colonnes, sans changement de structure.
// Glisser : souris après 4 px, doigt après un appui de `activationDelayMs` (le défilement reste libre avant),
// clavier (Espace/Entrée, flèches, Échap). Défilement automatique près des bords (défaut de dnd-kit).
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
  type ReactNode,
  useId,
  useMemo,
  useState,
} from "react";

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
  /** Appui avant le glisser au doigt, en ms. */
  activationDelayMs?: number;
  layout?: "scroll" | "tabs";
};

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

// Une cible de dépôt sous le pointeur (onglet, bandeau) l'emporte ; sinon coins les plus proches, adapté aux
// listes en colonnes (et seul calcul possible au clavier, sans pointeur).
const collisionDetection: CollisionDetection = (args) => {
  const zone = pointerWithin(args).find(
    (collision) =>
      (
        collision.data?.droppableContainer?.data.current as
          Partial<DropData> | undefined
      )?.kind === "zone",
  );
  return zone ? [zone] : closestCorners(args);
};

export function SortableBoard<T extends BoardItem>({
  columns,
  renderCard,
  getItemLabel,
  onMove,
  activationDelayMs = 250,
  layout = "scroll",
}: SortableBoardProps<T>) {
  const t = useTranslations("kanban");
  const contextId = useId();
  const tabsId = useId();
  const reducedMotion = useReducedMotion() ?? false;
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
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: activationDelayMs, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
  const shownColumns =
    layout === "tabs"
      ? columns.filter((column) => column.id === shownColumnId)
      : columns;

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t("instructions") },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {layout === "tabs" ? (
        <div
          role="tablist"
          onKeyDown={handleTabKeyDown}
          aria-label={t("columns")}
          className="glass flex gap-1 overflow-x-auto rounded-full p-1"
        >
          {columns.map((column) => (
            <BoardTab
              key={column.id}
              columnId={column.id}
              label={column.label}
              count={countOf(column, current[column.id] ?? [])}
              selected={column.id === shownColumnId}
              panelId={`${tabsId}-panel`}
              onSelect={() => setChosenColumnId(column.id)}
            />
          ))}
        </div>
      ) : null}
      <div
        id={layout === "tabs" ? `${tabsId}-panel` : undefined}
        role={layout === "tabs" ? "tabpanel" : undefined}
        className={cn(
          layout === "scroll"
            ? "-mx-page flex snap-x snap-mandatory gap-grid overflow-x-auto px-page pb-2 md:mx-0 md:px-0"
            : "mt-grid",
        )}
      >
        {shownColumns.map((column) => (
          <BoardColumnView
            key={column.id}
            column={column}
            itemIds={current[column.id] ?? []}
            itemsById={itemsById}
            renderCard={renderCard}
            reducedMotion={reducedMotion}
            roleDescription={t("roleDescription")}
            className={
              layout === "scroll" ? "w-72 shrink-0 snap-start md:w-80" : ""
            }
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
  className: string;
};

function BoardColumnView<T extends BoardItem>({
  column,
  itemIds,
  itemsById,
  renderCard,
  reducedMotion,
  roleDescription,
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
  children: (dragging: boolean) => ReactNode;
};

function SortableCard({
  id,
  reducedMotion,
  roleDescription,
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

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
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
