"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 3 · DENSITY 6.
// Feuille « Renommer l'article » : un champ (police `text-base` = 16 px, sinon iOS zoome ; 80 caractères) et
// deux boutons de 44 px. Entrée envoie. Vide ou inchangé : on ferme sans appel. Le serveur reclasse l'article
// seulement si son rayon n'avait pas été choisi à la main (spec). Échec : la feuille reste, saisie gardée, message
// (`label_too_long` expliqué, tout autre échec « Pas enregistré »).
// raccourci: le champ prend le focus à l'ouverture (`initialFocus` de Base UI) — sur iPhone le clavier peut ne pas
// s'ouvrir tout seul (focus hors geste, gotchas) ; un tap sur le champ l'ouvre. Relais synchrone à prévoir si Antoine le juge gênant.
import { useTranslations } from "next-intl";
import { type RefObject, useId, useRef, useState, useTransition } from "react";

import {
  renameShoppingItem,
  type ShoppingActionResult,
} from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";
import { SHOPPING_LABEL_MAX } from "@/modules/shopping/limits";
import type { ShoppingItem } from "@/modules/shopping/list-view";

import { ListSheet } from "./ListSheet";
import { SavingStatus } from "./SavingStatus";

type RenameItemSheetProps = {
  item: ShoppingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Élément qui reprend le focus à la fermeture. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

export function RenameItemSheet({
  item,
  open,
  onOpenChange,
  returnFocusRef,
}: RenameItemSheetProps) {
  const t = useTranslations("shopping");
  const errorId = useId();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(item.label);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ouverture : champ remis au libellé courant, message d'avant effacé (état ajusté au rendu, pas d'effet).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLabel(item.label);
      setError(null);
    }
  }

  function failureMessage(
    outcome: Awaited<ReturnType<typeof settleAction<ShoppingActionResult>>>,
  ): string | null {
    if (!outcome.ok) return t("list.notSaved");
    if (outcome.value.ok) return null;
    return outcome.value.code === "label_too_long"
      ? t("renameItem.labelTooLong")
      : t("list.notSaved");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next = label.trim();
    if (next === "" || next === item.label) {
      onOpenChange(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        renameShoppingItem(item.id, next),
      );
      const failure = failureMessage(outcome);
      startTransition(() => {
        if (failure === null) onOpenChange(false);
        else setError(failure);
      });
    });
  }

  return (
    <ListSheet
      open={open}
      onOpenChange={onOpenChange}
      initialFocus={inputRef}
      finalFocus={returnFocusRef}
      title={t("renameItem.title")}
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="sr-only">{t("renameItem.label")}</span>
          <input
            ref={inputRef}
            type="text"
            value={label}
            readOnly={pending}
            maxLength={SHOPPING_LABEL_MAX}
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby={error !== null ? errorId : undefined}
            onChange={(event) => setLabel(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-input bg-row px-3.5 text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring read-only:opacity-60"
          />
        </label>
        {error !== null && (
          <p
            id={errorId}
            role="alert"
            className="text-small font-medium text-destructive"
          >
            {error}
          </p>
        )}
        <SavingStatus pending={pending} className="block min-h-5" />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 cursor-pointer rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground"
          >
            {t("renameItem.cancel")}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 cursor-pointer rounded-full bg-primary px-5 text-body font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("renameItem.submit")}
          </button>
        </div>
      </form>
    </ListSheet>
  );
}
