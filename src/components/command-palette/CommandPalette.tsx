"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Fenêtre de la palette (DESIGN.md § 4–5, § 7) : Dialog de Base UI (focus piégé, Échap, focus rendu au
// déclencheur), opaque (`popover`, jamais de verre sur du verre), en haut de l'écran pour rester au-dessus
// du clavier mobile. Ouverture en Motion : opacity + scale 0,98 → 1, 0,2 s ease-out-expo ; fermeture
// 0,15 s ; ancrée en haut (`origin-top`), elle se déploie depuis son bord haut au lieu de son centre ;
// MotionConfig reducedMotion="user" (MotionRoot) coupe l'échelle et garde le fondu, ramené à 0,15 s. Voile `scrim` dessous
// (calque overlay) : fondu d'opacité seul, même durées et même courbe que le panneau, sans échelle.
// Le contenu n'est monté qu'ouvert : recherche et message d'erreur repartent à zéro à chaque ouverture.
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { EASE_OUT_EXPO, paletteDurations } from "./palette-motion";
import { PalettePanel } from "./PalettePanel";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations("palette");
  const { enter, exit } = paletteDurations(useReducedMotion() ?? false);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal keepMounted>
            {/* Voile `scrim` (DESIGN.md § 8, décision 10) : capte le clic hors de la palette. */}
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
            <Dialog.Viewport className="fixed inset-0 z-(--z-dialog) flex items-start justify-center px-page pt-page-top lg:pt-28">
              <Dialog.Popup
                aria-label={t("title")}
                render={
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      transition: { duration: enter, ease: EASE_OUT_EXPO },
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      transition: { duration: exit, ease: EASE_OUT_EXPO },
                    }}
                  />
                }
                className="flex w-full max-w-xl origin-top flex-col overflow-hidden rounded-tile bg-popover text-popover-foreground shadow-glass"
              >
                <PalettePanel onDone={() => onOpenChange(false)} />
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
