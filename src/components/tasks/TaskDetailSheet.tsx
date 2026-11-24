"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Fenêtre du détail `/tasks/[id]`, partagée par le détail et son état d'erreur (BRAIN-47). Dialog de Base UI
// (focus piégé, Échap, clic sur le voile, focus rendu), opaque (`popover`, jamais de verre sur du verre), voile
// `scrim`. Repli : sous 1024 px, tiroir bas (`rounded-tile` en haut, poignée qui ferme en glissant, ressort
// `bounce: 0.2`, 0,3 s, comme l'ajout rapide) ; à partir de 1024 px, panneau latéral à droite, pleine hauteur
// dans la marge de page (`opacity` + `x` 24, 0,2 s `ease-out-expo`). Mouvement réduit : fondus de 0,15 s.
// Fermer (croix, Échap, voile, poignée) : animation de sortie, puis retour à la liste (`closeHref`), ou rappel
// `onClose` quand la fenêtre n'a pas d'adresse (démo du kanban, état local).
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";

import {
  EASE_OUT_EXPO,
  paletteDurations,
} from "@/components/command-palette/palette-motion";
import { useMediaQuery } from "@/lib/use-media-query";

const DESKTOP = "(min-width: 1024px)";
const DRAWER_SPRING = { type: "spring", bounce: 0.2, duration: 0.3 } as const;
// Glissé de la poignée qui ferme le tiroir : distance (px) ou vitesse (px/s) vers le bas.
const CLOSE_OFFSET = 80;
const CLOSE_VELOCITY = 500;

type TaskDetailSheetProps = (
  | {
      /** Adresse de la liste rejointe à la fermeture, requête gardée (`/tasks?completed=1`). */
      closeHref: string;
      onClose?: never;
    }
  | {
      closeHref?: never;
      /** Appelé à la fin de l'animation de sortie, à la place de la navigation. */
      onClose: () => void;
    }
) & {
  /** Contenu de la fenêtre ; reçoit la croix de fermeture à placer dans sa première rangée. */
  children: (closeButton: ReactNode) => ReactNode;
};

export function TaskDetailSheet({
  closeHref,
  onClose,
  children,
}: TaskDetailSheetProps) {
  const t = useTranslations("tasks.detail");
  const router = useRouter();
  const reduced = useReducedMotion() ?? false;
  const desktop = useMediaQuery(DESKTOP);
  const dragControls = useDragControls();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(true);
  const { enter, exit } = paletteDurations(reduced);

  function onDragEnd(_event: PointerEvent, info: PanInfo) {
    if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) {
      setOpen(false);
    }
  }

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: enter } },
    exit: { opacity: 0, transition: { duration: exit } },
  };
  const panel = reduced
    ? fade
    : desktop
      ? {
          initial: { opacity: 0, x: 24 },
          animate: {
            opacity: 1,
            x: 0,
            transition: { duration: enter, ease: EASE_OUT_EXPO },
          },
          exit: {
            opacity: 0,
            x: 24,
            transition: { duration: exit, ease: EASE_OUT_EXPO },
          },
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0, transition: DRAWER_SPRING },
          exit: { y: "100%", transition: DRAWER_SPRING },
        };

  const closeButton = (
    <Dialog.Close
      ref={closeRef}
      render={
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        />
      }
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-pill-track hover:text-foreground"
    >
      <X aria-hidden="true" className="size-5" strokeWidth={2} />
      <span className="sr-only">{t("close")}</span>
    </Dialog.Close>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence
        onExitComplete={() =>
          onClose ? onClose() : router.push(closeHref, { scroll: false })
        }
      >
        {open && (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { duration: enter, ease: EASE_OUT_EXPO },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: exit, ease: EASE_OUT_EXPO },
                  }}
                />
              }
              className="fixed inset-0 z-(--z-overlay) bg-scrim"
            />
            <Dialog.Viewport className="fixed inset-0 z-(--z-dialog) flex items-end justify-center pt-page-top lg:items-stretch lg:justify-end lg:p-page lg:pt-detail-top lg:pr-detail-right">
              <Dialog.Popup
                aria-label={t("label")}
                // Pas le titre : au toucher, le clavier s'ouvrirait sur un détail qu'on vient seulement de lire.
                initialFocus={() => closeRef.current ?? true}
                render={
                  <motion.div
                    {...panel}
                    drag={desktop ? false : "y"}
                    dragControls={dragControls}
                    dragListener={false}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0, bottom: 1 }}
                    onDragEnd={onDragEnd}
                  />
                }
                className="flex max-h-full w-full flex-col overflow-y-auto overscroll-contain rounded-t-tile bg-popover pr-safe-right pb-safe-bottom pl-safe-left text-popover-foreground shadow-glass lg:max-w-md lg:rounded-tile lg:p-0"
              >
                {/* Poignée (mobile) : glisser vers le bas ferme ; décorative, le bouton Fermer suffit aux
                    lecteurs d'écran. Zone de 44 px de haut pour le pouce. */}
                <div
                  aria-hidden="true"
                  onPointerDown={(event) => dragControls.start(event)}
                  className="flex min-h-11 shrink-0 touch-none items-center justify-center lg:hidden"
                >
                  <span className="h-1 w-10 rounded-full bg-track" />
                </div>
                {children(closeButton)}
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
