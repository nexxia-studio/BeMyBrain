"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 3 · DENSITY 6.
// Coque commune des feuilles de l'écran Courses (changer de rayon, renommer, confirmer) : Dialog de Base UI
// (focus piégé, Échap, clic sur le voile, focus rendu), opaque (`popover`, jamais de verre sur du verre), voile
// `scrim`, comme le détail d'une tâche. Mobile : tiroir bas (`rounded-t-tile`, marge de zone sûre) ; à partir
// de 1024 px : fenêtre centrée. Entrée et sortie par transition CSS (`translate` + `opacity`, `ease-out-expo`),
// coupées en mouvement réduit. Pas de glisser-pour-fermer : la croix « Fermer » et le voile suffisent ici.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode, RefObject } from "react";

type ListSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Phrase sous le titre (reliée à la feuille, `aria-describedby`). */
  description?: string;
  /** Élément qui prend le focus à l'ouverture (par défaut : le premier du contenu, la croix). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Élément qui reprend le focus à la fermeture (le bouton « … » de la ligne). */
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function ListSheet({
  open,
  onOpenChange,
  title,
  description,
  initialFocus,
  finalFocus,
  children,
}: ListSheetProps) {
  const t = useTranslations("shopping.sheet");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-(--z-overlay) bg-scrim transition-opacity duration-200 ease-out-expo data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-(--z-dialog) flex items-end justify-center pt-page-top lg:items-center lg:p-page">
          <Dialog.Popup
            initialFocus={initialFocus}
            finalFocus={finalFocus}
            className="flex max-h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-tile bg-popover p-tile text-popover-foreground shadow-glass transition-[opacity,translate] duration-300 ease-out-expo data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0 lg:max-w-md lg:rounded-tile lg:data-ending-style:translate-y-0 lg:data-ending-style:opacity-0 lg:data-starting-style:translate-y-0 lg:data-starting-style:opacity-0"
          >
            <div className="flex items-start gap-2">
              <Dialog.Title className="min-w-0 flex-1 pt-2.5 font-heading text-title text-foreground">
                {title}
              </Dialog.Title>
              <Dialog.Close className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-pill-track hover:text-foreground">
                <X aria-hidden="true" className="size-5" strokeWidth={2} />
                <span className="sr-only">{t("close")}</span>
              </Dialog.Close>
            </div>
            {description !== undefined && (
              <Dialog.Description className="text-body text-muted-foreground">
                {description}
              </Dialog.Description>
            )}
            {children}
            {/* Zone sûre du bas (barre de l'iPhone) sous le tiroir. */}
            <div
              aria-hidden="true"
              className="h-safe-bottom shrink-0 lg:hidden"
            />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
