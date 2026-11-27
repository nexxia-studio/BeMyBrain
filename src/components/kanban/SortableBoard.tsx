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
// Sous 768 px, l'en-tête de colonne n'est pas répété sous l'onglet (masqué en CSS) : l'onglet nomme le panneau.
// Cible de dépôt en onglets (tâche 14 du plan todo-kanban), rendu seulement, la détection de collision n'en sait
// rien : l'onglet visé prend l'état actif et l'anneau de cible ; coupé par le bord, il est ramené en entier par le
// défilement de la barre (jamais de la page) ; la carte portée, large comme l'écran, masque la barre sous le doigt,
// donc un repère accroché à la copie redit libellé et compteur (`DropTargetMarker`). Amorce : fondu des onglets et
// bord ombré du côté où des onglets restent hors champ.
// Colonnes côte à côte, à la souris ou au doigt : la cible se cherche d'abord dans la colonne sous le pointeur
// (`createCollisionDetection`, qui dit pourquoi les coins les plus proches seuls échouent sur une colonne vide).
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
// Colonne repliable (`collapsible`, tâche 15 du plan todo-kanban) : état tenu par l'appelant (`collapsed`,
// `onCollapsedChange`), aucune mémorisation ici. À 768 px et plus, repliée, c'est un bandeau à la largeur de son
// libellé, écrit en entier à l'horizontale au-dessus du compteur (ni pivoté, ni abrégé, ni tronqué) ; cible de dépôt
// sur toute sa surface (zone, carte en tête), et tout le bandeau déplie au clic (zone du bouton étendue). Dépliée :
// colonne normale, pied compris, même bouton dans l'en-tête. Bouton natif (Entrée, Espace), `aria-expanded`, nom
// « libellé, n cartes, déplier / replier ». Sous 768 px, `collapsible` est ignoré : panneau d'onglet ordinaire, le
// bouton est masqué avec l'en-tête. `collapsed` sans `collapsible` est ignoré.
// Surfaces « Creux » (DESIGN.md § 5, variante retenue de la démo, seule variante) : colonne `bg-pill-track` posée à
// nu sur la brume, sans verre ni ombre, en-tête à l'encre (texte secondaire interdit sur le cœur d'un halo), aucun
// creux intérieur. La carte elle-même (opaque, bordée, `shadow-raised`) vient de l'appelant (`renderCard`).
// Colonne partielle (ex. 20 plus récentes) : `total` donne le compteur, `footer` se pose sous les cartes.
// Onglets : motif ARIA tablist (flèches gauche/droite en boucle, Début/Fin, seul l'onglet choisi est tabulable).
// Pendant le glisser, l'ordre est un brouillon local ; au dépôt, `onMove` reçoit les voisins de la carte et le
// brouillon est effacé : le parent met ses colonnes à jour dans le même événement (optimiste) pour que la carte
// reste où elle a été lâchée.
// Hydratation : `id` stable (`useId`) passé à DndContext, sinon le compteur de module de dnd-kit donne des
// `aria-describedby` différents entre serveur et client.
// Saisie (D6 de demo-plan.md) : la copie qui suit le pointeur se soulève (`y` −2, comme le survol d'une tuile) et
// s'incline de 2°, par le ressort du tiroir (`bounce` 0,2, 0,3 s, DESIGN.md § 7), avec `shadow-glass` (pas de token
// d'ombre plus marquée). Au dépôt, elle revient à plat pendant l'animation de dépôt de dnd-kit : dnd-kit garde la
// copie montée le temps du dépôt, et `LiftedContext` (hors de `DragOverlay`) lui dit que la saisie est finie. À sa
// place d'origine, la carte laisse une empreinte : son contenu devient transparent (la place est gardée, le nom reste
// lu par le lecteur d'écran) et un calque enfant dessine l'emplacement en pointillé (`outline`, sans changer la
// taille) : fond `row`, plus clair que la colonne (une carte en double se lirait blanche, bordée et ombrée), pointillé
// de 2 px `input` tracé vers l'intérieur (mesuré 5,04:1 contre la colonne sur brume, 3,48:1 au cœur d'un halo ; l'indigo
// reste à l'anneau de focus et à la cible de dépôt) ; l'`outline` de la carte reste à l'anneau de focus.
// Survol (pointeur fin, variantes `pointer-fine` et `hover`) : main ouverte, contour `input` (`outline` de 1 px sur
// le bord de la carte, rien ne se décale), `shadow-glass`, et la carte monte de 2 px en 0,3 s (course et durée du
// survol d'une tuile), par une transition CSS (`--ease-out-expo`). Aucun composant d'animation dans une carte
// déplaçable : un survol tenu par Motion se terminait avant le `mouseup` de dnd-kit et pouvait laisser la carte
// montée après le dépôt ; `:hover` suit le pointeur réel. La zone survolée est un enfant immobile du nœud mesuré par
// dnd-kit ; c'est son enfant qui monte : ni rectangle faussé, ni clignotement au bord bas, ni voisine déplacée. Rien
// pendant un glisser, rien au doigt (pas de survol collé après un tap sur iOS). Main fermée sur la copie.
// Mouvement réduit : pas d'animation de dépôt ni de glissement des cartes voisines ; la copie n'est ni inclinée ni
// soulevée, la carte survolée ne monte pas (`motion-safe` ; contour, ombre et empreinte restent, sans transition).
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
  useDndContext,
  useDndMonitor,
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
import { ChevronsLeftRight, ChevronsRightLeft } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  use,
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
  /** Repliable sur place à partir de 768 px (bouton dans l'en-tête) ; sous 768 px, un onglet comme les autres. */
  collapsible?: boolean;
  /**
   * État replié d'une colonne `collapsible`, tenu par l'appelant (`onCollapsedChange` du tableau) : un bandeau
   * étroit avec libellé et compteur, qui reçoit les cartes en tête. Sans effet sur une colonne non repliable.
   */
  collapsed?: boolean;
  /** Nombre total quand `items` n'en montre qu'une partie (ex. 20 plus récentes) ; défaut : `items.length`. */
  total?: number;
  /** Sous les cartes d'une colonne ouverte ou dépliée (ex. « Tout voir »). */
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
  /** Bouton d'une colonne `collapsible` : l'appelant enregistre l'état demandé et le repasse dans `collapsed`. */
  onCollapsedChange?: (columnId: string, collapsed: boolean) => void;
};

/** Appui avant le glisser au doigt (décision d'Antoine après l'essai iPhone, 2026-11-24). */
const ACTIVATION_DELAY_MS = 250;
/** Tolérance du doigt avant la saisie, distance de la souris avant le glisser : au-delà, plus de tap. */
const TOUCH_TOLERANCE_PX = 6;
const MOUSE_DISTANCE_PX = 4;
/** Avec `onOpen`, Entrée ouvre la carte : seul Espace la saisit. Dépôt inchangé (défaut de dnd-kit). */
const OPEN_KEYBOARD_CODES: KeyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
};
/** Copie saisie : inclinaison (demande d'Antoine) et soulèvement (survol d'une tuile, DESIGN.md § 7). */
const LIFT = { rotate: 2, y: -2 };
const FLAT = { rotate: 0, y: 0 };
/** Ressort du tiroir mobile (DESIGN.md § 7). */
const LIFT_SPRING = { type: "spring", bounce: 0.2, duration: 0.3 } as const;
/** Saisie en cours : lu par la copie, que dnd-kit garde montée pendant l'animation de dépôt. */
const LiftedContext = createContext(false);
/**
 * Survol d'une carte (pointeur fin, hors glisser) : contour `input`, `shadow-glass`, et montée de 2 px en 0,3 s
 * (course et durée du survol d'une tuile, DESIGN.md § 7), en CSS, jamais en mouvement réduit.
 */
const HOVER_CLASSES =
  "pointer-fine:group-hover/card:shadow-glass pointer-fine:group-hover/card:outline pointer-fine:group-hover/card:-outline-offset-1 pointer-fine:group-hover/card:outline-input motion-safe:pointer-fine:group-hover/card:-translate-y-0.5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out-expo";
/** Largeur des colonnes côte à côte : `md` de Tailwind. */
const WIDE_QUERY = "(min-width: 48rem)";

/** Place du repère de l'onglet visé au-dessus de la carte portée : sa hauteur (`min-h-9`) et son écart (`mb-2`). */
const MARKER_ROOM_PX = 44;
/** Marge gardée entre l'onglet visé et le bord de la barre d'onglets : son retrait (`p-1`). */
const TAB_REVEAL_MARGIN_PX = 4;
/** Amorce de la barre d'onglets : bord ombré (`w-8`) et fondu des onglets sur les derniers 10 % (`mask-*-from-90%`). */
const TAB_FADE_EDGE_PX = 32;
const TAB_FADE_SHARE = 0.1;

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

/**
 * Détection de collision du tableau. Dans l'ordre :
 * 1. une cible de dépôt sous le pointeur (onglet, bandeau) l'emporte ;
 * 2. colonnes côte à côte (`wide`, 768 px et plus), pointeur dans le rectangle d'une colonne : la cible est
 *    cherchée dans cette colonne seulement, la colonne elle-même si elle est vide, sinon la plus proche de ses
 *    cartes (la dernière quand on lâche sous elle). Le rectangle de la colonne est lu à l'écran, par l'élément
 *    de ses cibles : une colonne qui a des cartes n'est pas elle-même une cible ;
 * 3. sinon coins les plus proches parmi toutes les cibles affichées, adapté aux listes en colonnes (et seul calcul
 *    possible au clavier, sans pointeur : les flèches ne passent jamais par l'étape 2).
 * Piège de l'étape 3 seule (mesuré à 1440 px sur le vrai tableau) : les colonnes sont étirées à la plus haute. Les
 * quatre coins d'une colonne vide de 1 300 px sont loin de la carte portée, où qu'elle soit dedans (plus de 600 px
 * en moyenne), alors que ceux d'une carte de la colonne voisine, à la même hauteur, sont à une largeur de colonne
 * (300 px) : la carte lâchée au milieu d'une colonne vide restait chez la voisine, ou partait dans la suivante.
 * Même cause pour une carte lâchée loin sous la dernière carte d'une colonne courte, à côté d'une colonne longue.
 */
function createCollisionDetection(wide: boolean): CollisionDetection {
  return (all) => {
    const args = { ...all, droppableRects: shownRects(all.droppableRects) };
    const kindOf = (container: { data: { current?: unknown } }) =>
      (container.data.current as Partial<DropData> | undefined)?.kind;
    const zone = pointerWithin(args).find(
      (collision) =>
        collision.data?.droppableContainer !== undefined &&
        kindOf(collision.data.droppableContainer) === "zone",
    );
    if (zone) return [zone];
    const pointer = all.pointerCoordinates;
    if (wide && pointer) {
      // Cibles affichées, hors zones, rangées par colonne.
      const byColumn = new Map<Element, typeof args.droppableContainers>();
      for (const container of args.droppableContainers) {
        const column = container.node.current?.closest("[data-board-column]");
        if (
          !column ||
          kindOf(container) === "zone" ||
          !args.droppableRects.has(container.id)
        ) {
          continue;
        }
        const own = byColumn.get(column);
        if (own) own.push(container);
        else byColumn.set(column, [container]);
      }
      for (const [column, own] of byColumn) {
        // Partie visible de la colonne : le tableau défilé en masque une partie, le pointeur sur la barre latérale
        // ou la marge ne doit pas tomber dans le rectangle de la partie masquée.
        const box = column.getBoundingClientRect();
        const view = column.parentElement?.getBoundingClientRect() ?? box;
        if (
          pointer.x >= Math.max(box.left, view.left) &&
          pointer.x <= Math.min(box.right, view.right) &&
          pointer.y >= Math.max(box.top, view.top) &&
          pointer.y <= Math.min(box.bottom, view.bottom)
        ) {
          return closestCorners({ ...args, droppableContainers: own });
        }
      }
    }
    return closestCorners(args);
  };
}

/** Onglets hors champ de la barre d'onglets, de chaque côté. */
type TabsOverflow = { start: boolean; end: boolean };

function tabsOverflowOf(bar: HTMLElement): TabsOverflow {
  return {
    start: bar.scrollLeft > 1,
    end: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1,
  };
}

type Edges = { left: number; right: number };

/**
 * Défilement horizontal qui ramène un onglet (visé ou choisi) en entier dans la barre ; 0 s'il y est déjà. Du
 * côté où il reste des onglets hors champ, l'amorce est affichée : l'onglet s'arrête avant elle, sinon son
 * compteur sortirait à demi effacé par le fondu et le bord ombré.
 */
function revealOffset(tab: Edges, bar: Edges, more: TabsOverflow): number {
  const fade =
    Math.max(TAB_FADE_EDGE_PX, (bar.right - bar.left) * TAB_FADE_SHARE) +
    TAB_REVEAL_MARGIN_PX;
  const start = more.start ? fade : TAB_REVEAL_MARGIN_PX;
  const end = more.end ? fade : TAB_REVEAL_MARGIN_PX;
  if (tab.left < bar.left + start) return tab.left - bar.left - start;
  if (tab.right > bar.right - end) return tab.right - bar.right + end;
  return 0;
}

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
  onCollapsedChange,
}: SortableBoardProps<T>) {
  const t = useTranslations("kanban");
  const contextId = useId();
  const tabsId = useId();
  const reducedMotion = useReducedMotion() ?? false;
  const wide = useMediaQuery(WIDE_QUERY);
  const [draft, setDraft] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chosenColumnId, setChosenColumnId] = useState(columns[0]?.id);
  const tablist = useRef<HTMLDivElement>(null);
  // En onglets (sous 768 px), la détection ne regarde pas les colonnes : rien n'y change.
  const collisionDetection = useMemo(
    () => createCollisionDetection(wide),
    [wide],
  );
  const [tabsOverflow, setTabsOverflow] = useState<TabsOverflow>({
    start: false,
    end: false,
  });
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

  // Amorce de la barre d'onglets : relevée au défilement de la barre et quand sa taille ou celle d'un onglet
  // change (rotation, compteur qui gagne un chiffre). Rien avant l'hydratation : même balisage qu'au serveur.
  function measureTabs() {
    const bar = tablist.current;
    if (!bar) return;
    const next = tabsOverflowOf(bar);
    setTabsOverflow((shown) =>
      shown.start === next.start && shown.end === next.end ? shown : next,
    );
  }

  const columnCount = columns.length;
  useEffect(() => {
    const bar = tablist.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    // Premier relevé : l'observateur appelle sa fonction dès qu'il observe.
    const observer = new ResizeObserver(measureTabs);
    observer.observe(bar);
    for (const tab of bar.children) observer.observe(tab);
    return () => observer.disconnect();
  }, [columnCount]);

  const activeItem = activeId ? itemsById.get(activeId) : undefined;
  const panelId = (columnId: string) => `${tabsId}-panel-${columnId}`;
  const tabId = (columnId: string) => `${tabsId}-tab-${columnId}`;
  // Onglet visé par la carte portée, pour le repère accroché à la copie.
  const tabTargetOf = (overId: UniqueIdentifier): TabTarget | null => {
    const column = columns.find(
      (candidate) => zoneDropId(candidate.id, "tab") === overId,
    );
    return column
      ? {
          label: column.label,
          count: countOf(column, current[column.id] ?? []),
        }
      : null;
  };

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
      {/* Onglets sous 768 px seulement ; au-delà, `display: none` les retire aussi des cibles et du lecteur d'écran.
          Le verre est sur l'enveloppe : le fondu d'amorce ne touche que les onglets. */}
      <div className="glass relative rounded-full md:hidden">
        <div
          ref={tablist}
          role="tablist"
          onKeyDown={handleTabKeyDown}
          onScroll={measureTabs}
          aria-label={t("columns")}
          data-more-start={tabsOverflow.start || undefined}
          data-more-end={tabsOverflow.end || undefined}
          className="peer flex gap-1 overflow-x-auto rounded-full p-1 data-more-end:mask-r-from-90% data-more-start:mask-l-from-90%"
        >
          {columns.map((column) => (
            <BoardTab
              key={column.id}
              id={tabId(column.id)}
              columnId={column.id}
              label={column.label}
              count={countOf(column, current[column.id] ?? [])}
              selected={column.id === shownColumnId}
              panelId={panelId(column.id)}
              reducedMotion={reducedMotion}
              onSelect={() => setChosenColumnId(column.id)}
            />
          ))}
        </div>
        {/* Amorce : bord ombré du côté où des onglets restent hors champ, visible même quand aucun onglet n'est
            coupé par le bord ; les onglets s'y fondent (masque de la barre). */}
        <span
          aria-hidden="true"
          data-board-tabs-more="start"
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-8 rounded-l-full bg-linear-to-r from-pill-track to-transparent peer-data-more-start:block"
        />
        <span
          aria-hidden="true"
          data-board-tabs-more="end"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-8 rounded-r-full bg-linear-to-l from-pill-track to-transparent peer-data-more-end:block"
        />
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
            hoverable={activeId === null}
            wide={wide}
            panelId={wide ? undefined : panelId(column.id)}
            tabId={wide ? undefined : tabId(column.id)}
            onCollapsedChange={onCollapsedChange}
            className={column.id === shownColumnId ? "" : "hidden md:flex"}
          />
        ))}
      </div>
      <LiftedContext value={activeId !== null}>
        <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
          {activeItem ? (
            <LiftedCard reducedMotion={reducedMotion}>
              {renderCard(activeItem, { dragging: true, overlay: true })}
            </LiftedCard>
          ) : null}
          {activeItem ? <DropTargetMarker targetOf={tabTargetOf} /> : null}
        </DragOverlay>
      </LiftedContext>
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
  /** Aucun glisser en cours : les cartes réagissent au survol. */
  hoverable: boolean;
  /** Colonnes côte à côte (768 px et plus), connu après l'hydratation : le bandeau replié n'existe que là. */
  wide: boolean;
  /** Sous 768 px, la colonne est le panneau de son onglet. */
  panelId: string | undefined;
  /** Sous 768 px, l'onglet nomme le panneau : l'en-tête, redite du libellé, n'est pas affiché. */
  tabId: string | undefined;
  onCollapsedChange:
    ((columnId: string, collapsed: boolean) => void) | undefined;
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
  hoverable,
  wide,
  panelId,
  tabId,
  onCollapsedChange,
  className,
}: BoardColumnViewProps<T>) {
  const t = useTranslations("kanban");
  const headingId = useId();
  const regionId = useId();
  const collapsible = column.collapsible ?? false;
  // Repliée : mise en page du bandeau en CSS (`md:`), même balisage au serveur et au client. Le bandeau lui-même
  // (cible de dépôt en tête, cartes retirées) n'existe qu'à 768 px et plus, une fois la largeur connue ; avant
  // l'hydratation, les cartes rendues par le serveur sont masquées par le CSS.
  const folded = collapsible && (column.collapsed ?? false);
  const band = folded && wide;
  const { setNodeRef, isOver } = useDroppable({
    id: band ? zoneDropId(column.id, "band") : columnDropId(column.id),
    data: {
      kind: band ? "zone" : "column",
      columnId: column.id,
    } satisfies DropData,
    // Colonne ouverte : cible seulement vide, sinon ce sont ses cartes. Active, elle serait au clavier la plus
    // proche au-dessus de la première carte (flèche haut = renvoi en fin de colonne) et masquerait les onglets.
    disabled: !band && itemIds.length > 0,
  });
  const ToggleIcon = folded ? ChevronsLeftRight : ChevronsRightLeft;

  return (
    <section
      ref={setNodeRef}
      id={panelId}
      role={panelId ? "tabpanel" : undefined}
      aria-labelledby={tabId ?? headingId}
      data-board-column={column.id}
      className={cn(
        "flex flex-col gap-2 rounded-tile bg-pill-track p-tile md:shrink-0",
        // Bandeau : large comme son libellé, écrit en entier à l'horizontale (ni tronqué, ni pivoté).
        folded ? "md:relative md:w-auto md:items-center" : "md:w-80",
        isOver && "outline-2 outline-ring",
        className,
      )}
    >
      {/* Masqué sous 768 px, bouton compris : l'onglet dit déjà le libellé et le compteur. */}
      <div
        data-board-header=""
        className={cn(
          "hidden items-center gap-2 md:flex",
          folded && "md:flex-col-reverse",
        )}
      >
        <h2
          id={headingId}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-between gap-2 text-eyebrow text-foreground uppercase",
            folded &&
              "md:min-h-0 md:flex-none md:flex-col md:gap-1 md:whitespace-nowrap",
          )}
        >
          <span>{column.label}</span>
          <span className="tabular-nums">{countOf(column, itemIds)}</span>
        </h2>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={!folded}
            aria-controls={regionId}
            // Nom du bouton : libellé, compteur, action.
            aria-label={t(folded ? "expand" : "collapse", {
              column: column.label,
              count: countOf(column, itemIds),
            })}
            onClick={() => onCollapsedChange?.(column.id, !folded)}
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full text-foreground pointer-fine:hover:bg-row",
              // Replié : tout le bandeau déplie au clic (la cible de dépôt, elle, est la colonne entière).
              folded &&
                "md:after:absolute md:after:inset-0 md:after:rounded-tile",
            )}
          >
            <ToggleIcon aria-hidden="true" className="size-5" />
          </button>
        ) : null}
      </div>
      <div
        id={regionId}
        className={cn("flex flex-col gap-2", folded && "md:hidden")}
      >
        {band ? null : (
          <>
            <SortableContext
              id={column.id}
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              <div data-board-cards="" className="flex min-h-11 flex-col gap-2">
                {itemIds.map((id) => {
                  const item = itemsById.get(id);
                  return item ? (
                    <SortableCard
                      key={id}
                      id={id}
                      reducedMotion={reducedMotion}
                      roleDescription={roleDescription}
                      onOpen={onOpen}
                      hoverable={hoverable}
                    >
                      {(dragging) =>
                        renderCard(item, { dragging, overlay: false })
                      }
                    </SortableCard>
                  ) : null;
                })}
              </div>
            </SortableContext>
            {column.footer}
          </>
        )}
      </div>
    </section>
  );
}

type SortableCardProps = {
  id: string;
  reducedMotion: boolean;
  roleDescription: string;
  onOpen: ((id: string) => void) | undefined;
  hoverable: boolean;
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
  hoverable,
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
      className="relative touch-manipulation rounded-lg select-none pointer-fine:cursor-grab"
    >
      {/* Zone survolée, immobile : c'est son enfant qui monte, jamais le nœud mesuré par dnd-kit. */}
      <div className="group/card rounded-lg">
        {/* Empreinte : contenu transparent mais à sa taille (la colonne ne bouge pas) et toujours lu par le
            lecteur d'écran, qui garde le nom de la carte focalisée (`invisible` le retirerait). */}
        <div
          data-board-lift=""
          className={cn(
            "rounded-lg",
            isDragging && "opacity-0",
            hoverable && HOVER_CLASSES,
          )}
        >
          {children(isDragging)}
        </div>
      </div>
      {/* Pointillé sur un enfant : l'`outline` de la carte reste à l'anneau de focus (saisie au clavier). */}
      {isDragging ? (
        <span
          aria-hidden="true"
          data-testid="board-footprint"
          className="pointer-events-none absolute inset-0 rounded-lg bg-row outline-2 -outline-offset-2 outline-input outline-dashed"
        />
      ) : null}
    </div>
  );
}

type LiftedCardProps = { reducedMotion: boolean; children: ReactNode };

/** Copie qui suit le pointeur : soulevée et inclinée pendant la saisie, à plat au dépôt. */
function LiftedCard({ reducedMotion, children }: LiftedCardProps) {
  const lifted = use(LiftedContext);
  return (
    <motion.div
      data-board-overlay
      initial={FLAT}
      animate={lifted && !reducedMotion ? LIFT : FLAT}
      transition={reducedMotion ? { duration: 0 } : LIFT_SPRING}
      className="rounded-lg shadow-glass pointer-fine:cursor-grabbing"
    >
      {children}
    </motion.div>
  );
}

type TabTarget = { label: string; count: number };

type DropTargetMarkerProps = {
  targetOf: (overId: UniqueIdentifier) => TabTarget | null;
};

/**
 * Repère de l'onglet visé, accroché à la copie portée : la carte, large comme l'écran, masque la barre d'onglets
 * sous le doigt. Même pilule que l'onglet actif, au-dessus de la carte ; sans place au-dessus (carte en haut de
 * l'écran), en dessous. Lecture seule de la cible courante de dnd-kit, rien n'est annoncé (annonces existantes).
 * Il rend `null` hors cible et ne doit jamais être monté en permanence : dnd-kit mesure le premier enfant du calque
 * du glisser quand il est seul, sinon son enveloppe. Cette mesure se fait au montage du calque et au dépôt, deux
 * instants où le repère est absent (aucun onglet visé) : la carte inclinée est mesurée. Monté en permanence, il
 * ferait mesurer l'enveloppe droite à sa place et décalerait collisions et animation de dépôt.
 */
function DropTargetMarker({ targetOf }: DropTargetMarkerProps) {
  const { over } = useDndContext();
  const target = over ? targetOf(over.id) : null;
  const marker = useRef<HTMLDivElement>(null);
  const targetLabel = target?.label;

  // Côté choisi dans le DOM, sans état : à l'apparition du repère, puis à chaque mouvement de la carte portée.
  function place() {
    const node = marker.current;
    const carried = node?.parentElement;
    if (!node || !carried) return;
    if (carried.getBoundingClientRect().top < MARKER_ROOM_PX) {
      node.dataset.side = "below";
    } else {
      delete node.dataset.side;
    }
  }

  useLayoutEffect(place, [targetLabel]);
  useDndMonitor({ onDragMove: place });

  if (!target) return null;
  return (
    <div
      ref={marker}
      aria-hidden="true"
      data-board-drop-marker=""
      className="pointer-events-none absolute bottom-full left-0 mb-2 flex min-h-9 items-center gap-2 rounded-full bg-pill-active px-4 text-small font-semibold whitespace-nowrap text-foreground shadow-raised outline-2 outline-ring data-[side=below]:top-full data-[side=below]:bottom-auto data-[side=below]:mt-2 data-[side=below]:mb-0"
    >
      <span>{target.label}</span>
      <span className="tabular-nums">{target.count}</span>
    </div>
  );
}

type BoardTabProps = {
  id: string;
  columnId: string;
  label: string;
  count: number;
  selected: boolean;
  panelId: string;
  reducedMotion: boolean;
  onSelect: () => void;
};

function BoardTab({
  id,
  columnId,
  label,
  count,
  selected,
  panelId,
  reducedMotion,
  onSelect,
}: BoardTabProps) {
  const { setNodeRef, node, isOver } = useDroppable({
    id: zoneDropId(columnId, "tab"),
    data: { kind: "zone", columnId } satisfies DropData,
  });

  // Onglet visé pendant un glisser, ou choisi, coupé par le bord de la barre ou pris dans son amorce : la barre
  // défile (jamais la page) jusqu'à le montrer en entier, hors de l'amorce. En butée, le navigateur borne le
  // défilement et l'amorce de ce côté disparaît.
  const shown = isOver || selected;
  useEffect(() => {
    const tab = node.current;
    const bar = tab?.parentElement;
    if (!shown || !tab || !bar) return;
    const field = bar.getBoundingClientRect();
    // Barre masquée (768 px et plus) : rien à faire défiler.
    if (field.width === 0) return;
    const left = revealOffset(
      tab.getBoundingClientRect(),
      field,
      tabsOverflowOf(bar),
    );
    if (left !== 0) {
      bar.scrollBy({ left, behavior: reducedMotion ? "auto" : "smooth" });
    }
  }, [shown, node, reducedMotion]);

  return (
    <button
      ref={setNodeRef}
      id={id}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      aria-controls={selected ? panelId : undefined}
      data-drop-target={isOver || undefined}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-small font-semibold",
        // Onglet visé pendant un glisser : état actif complet, cerné de l'anneau de la cible de dépôt.
        selected || isOver
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
