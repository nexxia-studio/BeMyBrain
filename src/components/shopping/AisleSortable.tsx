"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ordre des rayons au glisser (spec listes, « Ordre des rayons », scénario 3). Seul fichier de l'écran Courses qui
// importe dnd-kit (verrou eslint, comme SortableBoard pour le kanban). Liste verticale d'une colonne : chaque
// rayon est une cible, la prise est une poignée dans son en-tête (44 px, jamais le rayon entier : le défilement et
// le tap sur une ligne restent libres). Capteurs comme le kanban : souris après 4 px, doigt après un appui de
// 250 ms sur la poignée (le défilement reste libre avant), clavier (Espace ou Entrée, flèches, Échap).
// Aucun aimant de défilement (`snap-*`) sur la colonne ni sur un ancêtre pendant un glisser : le défilement
// automatique de dnd-kit avance par petits `scrollBy`, que l'aimant transforme en sauts (gotcha D4 du kanban).
// Aucun composant d'animation (Motion) dans un rayon déplaçable : les voisins glissent par la transition CSS de
// dnd-kit, coupée en mouvement réduit. Pas de `DragOverlay` : le rayon saisi suit le pointeur en place (axe
// vertical seulement), soulevé par une ombre.
// Les rayons vides ne sont pas affichés : les rayons masqués gardent leur place dans l'ordre complet lu (`applyVisibleOrder`, 12 clés).
// Au dépôt, l'ordre est posé tout de suite (`useOptimistic`, dans une transition) puis enregistré par
// `setShoppingAisleOrder` (`settleAction`) ; refus ou panne : retour à l'ordre d'avant et message.
import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
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
import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useId,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { setShoppingAisleOrder } from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { AisleKey } from "@/modules/shopping/aisles";
import type { AisleGroup } from "@/modules/shopping/list-view";
import { applyVisibleOrder } from "@/modules/shopping/visible-order";


const ACTIVATION_DELAY_MS = 250;
const TOUCH_TOLERANCE_PX = 6;
const MOUSE_DISTANCE_PX = 4;

type AisleSortableProps = {
  /** Rayons non vides, dans l'ordre affiché. */
  aisles: readonly AisleGroup[];
  /** Ordre complet des 12 rayons (masqués compris), tel que lu. */
  order: readonly AisleKey[];
  /** Un rayon ; `handle` est la poignée à poser dans son en-tête (absente s'il n'y a qu'un rayon). */
  renderAisle: (aisle: AisleGroup, handle: ReactNode) => ReactNode;
};

function reorder(
  aisles: readonly AisleGroup[],
  order: readonly AisleKey[],
): AisleGroup[] {
  return [...aisles].sort(
    (a, b) => order.indexOf(a.aisleKey) - order.indexOf(b.aisleKey),
  );
}

export function AisleSortable({
  aisles,
  order,
  renderAisle,
}: AisleSortableProps) {
  const t = useTranslations("shopping.aisleSort");
  const tAisles = useTranslations("shopping.aisles");
  const contextId = useId();
  const [shown, applyOrder] = useOptimistic(aisles, reorder);
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

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
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const keys = shown.map((aisle) => aisle.aisleKey);
  const labelOf = (id: UniqueIdentifier) => tAisles(String(id) as AisleKey);
  const position = (id: UniqueIdentifier | undefined) =>
    id === undefined ? 0 : keys.indexOf(String(id) as AisleKey) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("picked", {
        aisle: labelOf(active.id),
        position: position(active.id),
        count: keys.length,
      }),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? t("over", {
            aisle: labelOf(active.id),
            position: position(over.id),
            count: keys.length,
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      t("dropped", {
        aisle: labelOf(active.id),
        position: position(over?.id ?? active.id),
        count: keys.length,
      }),
    onDragCancel: ({ active }) => t("cancelled", { aisle: labelOf(active.id) }),
  };

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || over.id === active.id) return;
    const from = keys.indexOf(active.id as AisleKey);
    const to = keys.indexOf(over.id as AisleKey);
    if (from < 0 || to < 0) return;
    const visible = arrayMove(keys, from, to);
    setFailed(false);
    startTransition(async () => {
      applyOrder(visible);
      const outcome = await settleAction(() =>
        setShoppingAisleOrder(applyVisibleOrder(order, visible)),
      );
      if (outcome.ok && outcome.value.ok) return;
      // Après un `await`, une mise à jour sort de la transition : remise dedans (gotchas).
      startTransition(() => setFailed(true));
    });
  }

  const sortable = shown.length > 1;

  return (
    <>
      {failed && (
        <p role="alert" className="text-caption text-destructive">
          {t("notSaved")}
        </p>
      )}
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: t("instructions") },
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={keys} strategy={verticalListSortingStrategy}>
          {shown.map((aisle) => (
            <SortableAisle
              key={aisle.aisleKey}
              id={aisle.aisleKey}
              disabled={!sortable}
              reducedMotion={reducedMotion}
              handleLabel={t("handle", { aisle: tAisles(aisle.aisleKey) })}
              roleDescription={t("roleDescription")}
              render={(handle) => renderAisle(aisle, handle)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </>
  );
}

type SortableAisleProps = {
  id: AisleKey;
  disabled: boolean;
  reducedMotion: boolean;
  handleLabel: string;
  roleDescription: string;
  render: (handle: ReactNode) => ReactNode;
};

function SortableAisle({
  id,
  disabled,
  reducedMotion,
  handleLabel,
  roleDescription,
  render,
}: SortableAisleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, attributes: { roleDescription } });

  return (
    <div
      ref={setNodeRef}
      data-aisle-sortable={id}
      style={{
        // Axe vertical seulement : la colonne ne se déplace pas de côté.
        transform: CSS.Transform.toString(
          transform && { ...transform, x: 0, scaleX: 1, scaleY: 1 },
        ),
        transition: reducedMotion ? undefined : transition,
      }}
      className={cn(
        "relative rounded-tile",
        isDragging && "z-(--z-lifted) shadow-glass",
      )}
    >
      {render(
        disabled ? null : (
          <AisleHandle
            label={handleLabel}
            attributes={attributes}
            listeners={listeners}
            setActivatorNodeRef={setActivatorNodeRef}
          />
        ),
      )}
    </div>
  );
}

function AisleHandle({
  label,
  attributes,
  listeners,
  setActivatorNodeRef,
}: {
  label: string;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={label}
      {...attributes}
      {...listeners}
      // `touch-manipulation` : le défilement reste libre avant l'appui long de 250 ms.
      className="-my-2 -mr-2 ml-auto flex size-11 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
    >
      <GripVertical aria-hidden="true" className="size-5" strokeWidth={2} />
    </button>
  );
}
