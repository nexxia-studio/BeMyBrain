"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ajout rapide (spec todo-unifiee, « Ajout rapide ») : un seul composant pour tous les types déclarés
// (quick-add-types.ts). Dialog de Base UI (focus piégé, Échap, clic sur le voile, focus rendu au déclencheur),
// opaque (`popover`, jamais de verre sur du verre). Repli : sous 1024 px, tiroir bas (`rounded-tile` en haut,
// poignée qui ferme en glissant vers le bas, ressort `bounce: 0.2`, 0,3 s, DESIGN.md § 7) ; à partir de
// 1024 px, dialogue centré en haut avec la même entrée que la palette (opacity + scale 0,98, 0,2 s). Mouvement
// réduit : fondus de 0,15 s seulement. Voile `scrim` : fondu d'opacité seul. Sélecteur de types (pilule comme
// la bascule Privé / Pro) seulement à partir de deux types.
// Clavier : focus d'office dans le champ désigné par le formulaire, même ouvert au toucher (Base UI ne
// focalise que la fenêtre au toucher, pour ne pas ouvrir le clavier : ici, on le veut). Sur iOS, le clavier
// recouvre la page sans la redimensionner : le tiroir remonte de la hauteur masquée (`useKeyboardInset`,
// marge basse du conteneur, pas d'animation de position) ; Android redimensionne la page (viewport).
import { Dialog } from "@base-ui/react/dialog";
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useReducedMotion,
} from "motion/react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import {
  EASE_OUT_EXPO,
  paletteDurations,
} from "@/components/command-palette/palette-motion";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

import type { QuickAddScope, QuickAddType } from "./quick-add-types";

const DESKTOP = "(min-width: 1024px)";
const DRAWER_SPRING = { type: "spring", bounce: 0.2, duration: 0.3 } as const;
// Glissé de la poignée qui ferme le tiroir : distance (px) ou vitesse (px/s) vers le bas.
const CLOSE_OFFSET = 80;
const CLOSE_VELOCITY = 500;

type QuickAddProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: readonly QuickAddType[];
  /** Type retenu ; inconnu → premier type déclaré. */
  typeKey: string;
  onTypeChange: (key: string) => void;
  /** Côté et espace courants, passés au formulaire. */
  scope: QuickAddScope;
};

export function QuickAdd({
  open,
  onOpenChange,
  types,
  typeKey,
  onTypeChange,
  scope,
}: QuickAddProps) {
  const t = useTranslations("quickAdd");
  const reduced = useReducedMotion() ?? false;
  const desktop = useMediaQuery(DESKTOP);
  const dragControls = useDragControls();
  const initialFocusRef = useRef<HTMLInputElement | null>(null);
  // Écouteurs du clavier posés seulement tiroir ouvert (mobile).
  const keyboardInset = useKeyboardInset(open && !desktop);
  const { enter, exit } = paletteDurations(reduced);
  const current = types.find((type) => type.key === typeKey) ?? types[0];
  const Form = current.Form;

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: enter } },
    exit: { opacity: 0, transition: { duration: exit } },
  };
  const panel = reduced
    ? fade
    : desktop
      ? {
          initial: { opacity: 0, scale: 0.98 },
          animate: {
            opacity: 1,
            scale: 1,
            transition: { duration: enter, ease: EASE_OUT_EXPO },
          },
          exit: {
            opacity: 0,
            scale: 0.98,
            transition: { duration: exit, ease: EASE_OUT_EXPO },
          },
        }
      : {
          initial: { y: "100%" },
          animate: { y: 0, transition: DRAWER_SPRING },
          exit: { y: "100%", transition: DRAWER_SPRING },
        };

  function onDragEnd(_event: PointerEvent, info: PanInfo) {
    if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
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
            <Dialog.Viewport
              data-testid="quick-add-viewport"
              // Hauteur du clavier iOS (0 sinon) : le tiroir reste au-dessus, le bouton Ajouter visible.
              style={{ paddingBottom: keyboardInset || undefined }}
              className="fixed inset-0 z-(--z-dialog) flex items-end justify-center lg:items-start lg:px-page lg:pt-28"
            >
              <Dialog.Popup
                aria-label={t(`types.${current.key}.title`)}
                // Au toucher aussi (Base UI focaliserait la fenêtre) : le clavier s'ouvre d'office.
                initialFocus={() => initialFocusRef.current ?? true}
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
                className="flex max-h-full w-full flex-col overflow-y-auto overscroll-contain rounded-t-tile bg-popover pr-safe-right pb-safe-bottom pl-safe-left text-popover-foreground shadow-glass lg:max-w-xl lg:origin-top lg:rounded-tile lg:p-0"
              >
                {/* Poignée (mobile) : glisser vers le bas ferme ; décorative pour les lecteurs d'écran,
                    qui ferment par le bouton Fermer ci-dessous. Zone de 44 px de haut pour le pouce. */}
                <div
                  aria-hidden="true"
                  onPointerDown={(event) => dragControls.start(event)}
                  className="flex min-h-11 shrink-0 touch-none items-center justify-center lg:hidden"
                >
                  <span className="h-1 w-10 rounded-full bg-track" />
                </div>
                <div className="flex flex-col gap-4 px-4 pb-4 lg:p-5">
                  {types.length > 1 && (
                    <div
                      role="group"
                      aria-label={t("typesLabel")}
                      className="flex gap-1 self-start rounded-full bg-pill-track p-1"
                    >
                      {types.map((type) => {
                        const active = type.key === current.key;
                        return (
                          <motion.button
                            key={type.key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onTypeChange(type.key)}
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.1, ease: "easeOut" }}
                            className={cn(
                              "flex min-h-11 items-center gap-2 rounded-full px-4.5 text-body font-semibold lg:px-5.5",
                              active
                                ? "bg-pill-active text-foreground shadow-raised"
                                : "text-muted-foreground",
                            )}
                          >
                            <type.icon
                              aria-hidden="true"
                              className="size-4.5"
                              strokeWidth={2}
                            />
                            {t(`types.${type.key}.label`)}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                  <Form
                    scope={scope}
                    initialFocusRef={initialFocusRef}
                    onClose={() => onOpenChange(false)}
                  />
                </div>
                {/* Fermeture sans clavier ni geste (VoiceOver) : bouton réservé aux lecteurs d'écran, la
                    charte n'a pas de bouton Fermer visible (voile, Échap et poignée suffisent à l'œil). */}
                <Dialog.Close className="sr-only">{t("close")}</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
