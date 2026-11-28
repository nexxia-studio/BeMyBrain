"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 3 · DENSITY 6.
// Feuille « Changer de rayon » (spec : menu de ligne, pas de glisser d'article entre rayons). Une ligne de 44 px
// par rayon, dans l'ordre par défaut ; le rayon actuel porte une coche (`aria-current`). Un choix part tout de
// suite (`moveShoppingItemToAisle` : l'article change de rayon ET la correction est mémorisée par le serveur) ;
// pendant l'appel les lignes sont désactivées, l'échec garde la feuille ouverte avec un message.
// Surface : la feuille est `popover` (opaque) ; ligne au survol `pill-track`, comme les menus.
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { type RefObject, useState, useTransition } from "react";

import { moveShoppingItemToAisle } from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import { type AisleKey, DEFAULT_AISLE_ORDER } from "@/modules/shopping/aisles";
import type { ShoppingItem } from "@/modules/shopping/list-view";

import { ListSheet } from "./ListSheet";

type MoveAisleSheetProps = {
  item: ShoppingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Élément qui reprend le focus à la fermeture. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

export function MoveAisleSheet({
  item,
  open,
  onOpenChange,
  returnFocusRef,
}: MoveAisleSheetProps) {
  const t = useTranslations("shopping");
  const tAisles = useTranslations("shopping.aisles");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  // Ouverture : message d'échec d'avant effacé (état ajusté au rendu, pas d'effet).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFailed(false);
  }

  function choose(aisleKey: AisleKey) {
    if (pending) return;
    if (aisleKey === item.aisleKey) {
      onOpenChange(false);
      return;
    }
    setFailed(false);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        moveShoppingItemToAisle(item.id, aisleKey),
      );
      // Après un `await`, une mise à jour sort de la transition : remise dedans (gotchas).
      startTransition(() => {
        if (outcome.ok && outcome.value.ok) onOpenChange(false);
        else setFailed(true);
      });
    });
  }

  return (
    <ListSheet
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={returnFocusRef}
      title={t("moveAisle.title")}
      description={t("moveAisle.description", { label: item.label })}
    >
      <ul className="flex flex-col gap-1" aria-busy={pending}>
        {DEFAULT_AISLE_ORDER.map((aisleKey) => {
          const current = aisleKey === item.aisleKey;
          return (
            <li key={aisleKey}>
              <button
                type="button"
                data-aisle={aisleKey}
                aria-current={current ? "true" : undefined}
                disabled={pending}
                onClick={() => choose(aisleKey)}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-body font-semibold text-foreground hover:bg-pill-track focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
                  current && "bg-pill-track",
                )}
              >
                <span className="flex size-4 shrink-0 items-center">
                  {current && (
                    <Check
                      aria-hidden="true"
                      className="size-4 text-link"
                      strokeWidth={2}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">{tAisles(aisleKey)}</span>
                {current && (
                  <span className="sr-only">{t("moveAisle.current")}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {failed && (
        <p role="alert" className="text-small font-medium text-destructive">
          {t("list.notSaved")}
        </p>
      )}
    </ListSheet>
  );
}
