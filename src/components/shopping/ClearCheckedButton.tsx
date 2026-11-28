"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 3 · DENSITY 6.
// « Vider les cochés » (spec Q12) : le bouton n'existe que s'il y a des cochés (`count` > 0), pastille secondaire
// de 44 px (DESIGN.md § 5, Boutons) avec le nombre ; il ouvre une confirmation (feuille opaque) qui dit combien
// d'articles partent, définitivement. Rien n'est envoyé avant « Supprimer ». Pendant l'appel : boutons désactivés ;
// échec : la confirmation reste, message « Pas enregistré ». Succès : la feuille se ferme, le rendu serveur
// (`refresh()` de l'action) apporte la liste sans les cochés. Le nombre affiché pendant l'appel ne bouge pas.
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { clearCheckedShoppingItems } from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";

import { ListSheet } from "./ListSheet";

type ClearCheckedButtonProps = {
  /** Nombre d'articles cochés de la liste affichée. */
  count: number;
};

export function ClearCheckedButton({ count }: ClearCheckedButtonProps) {
  const t = useTranslations("shopping");
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    if (pending) return;
    setFailed(false);
    startTransition(async () => {
      const outcome = await settleAction(() => clearCheckedShoppingItems());
      // Après un `await`, une mise à jour sort de la transition : remise dedans (gotchas).
      startTransition(() => {
        if (outcome.ok && outcome.value.ok) setOpen(false);
        else setFailed(true);
      });
    });
  }

  // Les cochés partis (rendu serveur), plus rien à vider : le bouton disparaît, la feuille avec lui.
  if (count === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 self-end rounded-full border border-border bg-secondary px-3.5 text-small font-semibold text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Trash2
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={2}
        />
        {t("clearChecked.button", { count })}
      </button>
      <ListSheet
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next);
        }}
        title={t("clearChecked.title")}
        description={t("clearChecked.description", { count })}
      >
        {failed && (
          <p role="alert" className="text-small font-medium text-destructive">
            {t("list.notSaved")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="min-h-11 cursor-pointer rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("clearChecked.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="min-h-11 cursor-pointer rounded-full bg-destructive px-5 text-body font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("clearChecked.confirm")}
          </button>
        </div>
      </ListSheet>
    </>
  );
}
