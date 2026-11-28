"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Champ d'ajout rapide des Courses (spec « Ajout rapide »), modèle : `SubtaskAddField`. Entrée ajoute, le champ se
// vide et garde le focus : le clavier d'iOS reste ouvert pour enchaîner. Pendant l'appel le champ est en lecture
// seule, jamais `disabled` (le focus partirait), jamais remonté ni remplacé (même élément du début à la fin).
// Le bouton « Ajouter » rend le focus au champ de façon synchrone dans le geste (iOS n'ouvre ou ne garde le clavier
// que pour un focus donné dans le geste) ; `preventScroll` évite le saut de page.
// Police `text-base` (16 px : sinon iOS zoome), zones tactiles de 44 px. Surface du champ de la charte
// (DESIGN.md § 5, Champs : `border-input bg-row`).
// Estompage pendant l'appel : `has-[input:read-only]`, jamais `has-read-only` (gotcha).
// Après un `await`, une mise à jour sort de la transition : remise dedans, pour que le champ se vide au moment où
// il redevient modifiable (gotcha). Échec : saisie gardée, message sous la ligne ; erreurs `list_full` et
// `label_too_long` traduites ; tout autre échec : « Pas enregistré ». Pas de `catch {}` nu : `settleAction`.
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";

import {
  addShoppingItem,
  type ShoppingActionResult,
} from "@/app/(app)/lists/shopping/actions";
import { settleAction } from "@/lib/settle-action";
import { SHOPPING_LABEL_MAX } from "@/modules/shopping/limits";

export function QuickAddField() {
  const t = useTranslations("shopping");
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function failureMessage(
    outcome: Awaited<ReturnType<typeof settleAction<ShoppingActionResult>>>,
  ): string | null {
    if (!outcome.ok) return t("list.notSaved");
    const result = outcome.value;
    if (result.ok) return null;
    if (result.code === "list_full") return t("quickAdd.listFull");
    if (result.code === "label_too_long") return t("quickAdd.labelTooLong");
    return t("list.notSaved");
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Synchrone, dans le geste (Entrée ou bouton) : garde le clavier d'iOS ouvert.
    inputRef.current?.focus({ preventScroll: true });
    if (label.trim() === "" || pending) return;
    setError(null);
    startTransition(async () => {
      const outcome = await settleAction(() => addShoppingItem(label));
      const failure = failureMessage(outcome);
      startTransition(() => {
        if (failure === null) setLabel("");
        else setError(failure);
      });
    });
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-1.5">
      <div className="flex min-h-11 items-center rounded-lg border border-input bg-row has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring has-[input:read-only]:opacity-60">
        <label className="flex min-w-0 flex-1 cursor-text items-center">
          <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
            <Plus aria-hidden="true" className="size-4.5" strokeWidth={2} />
          </span>
          <span className="sr-only">{t("quickAdd.label")}</span>
          <input
            ref={inputRef}
            type="text"
            value={label}
            readOnly={pending}
            maxLength={SHOPPING_LABEL_MAX}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={t("quickAdd.label")}
            aria-describedby={error !== null ? errorId : undefined}
            onChange={(event) => setLabel(event.target.value)}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg px-4 text-body font-medium text-link outline-none focus-visible:outline-2 focus-visible:outline-ring"
        >
          {t("quickAdd.submit")}
        </button>
      </div>
      {error !== null && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
