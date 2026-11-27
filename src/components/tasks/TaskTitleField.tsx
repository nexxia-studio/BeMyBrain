"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 2 · DENSITY 6.
// Titre du détail, éditable d'un tap ou d'un clic dessus, sans bouton (BRAIN-46, tâche 23). Au repos il se lit
// comme un titre (`font-heading text-title`, fond et bord transparents) avec un crayon de 16 px en encre
// secondaire, visible sans survol (aucun survol sur un iPhone) ; survol `pill-track` ; au focus, champ net de la
// charte (`border-input bg-row`, anneau). Libellé `sr-only` : le titre n'a pas de libellé visible.
// Un seul `textarea`, toujours monté : le tap le focalise directement et le clavier d'iOS s'ouvre (gotchas).
// Entrée quitte le champ ; l'enregistrement part du seul `onBlur`, donc une fois. Pas d'animation.
// Sans logique de données : l'appelant tient la valeur, valide et enregistre.
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

import type { FieldError } from "./DetailField";

type TaskTitleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Départ du champ (Entrée comprise) : l'appelant enregistre. */
  onSave: (value: string) => void;
  /** Pendant l'appel d'enregistrement. */
  disabled?: boolean;
  /** Messages déjà traduits, sous le champ. */
  errors?: FieldError[];
};

export function TaskTitleField({
  value,
  onChange,
  onSave,
  disabled = false,
  errors = [],
}: TaskTitleFieldProps) {
  const t = useTranslations("tasks");
  const fieldId = useId();

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={fieldId} className="sr-only">
        {t("detail.title")}
      </label>
      <div className="relative">
        <textarea
          id={fieldId}
          rows={1}
          value={value}
          disabled={disabled}
          maxLength={TASK_TITLE_MAX}
          enterKeyHint="done"
          aria-describedby={
            errors.length > 0
              ? errors.map((error) => error.id).join(" ")
              : undefined
          }
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Un titre tient sur une ligne : Entrée valide (le départ du champ enregistre).
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
          onBlur={() => onSave(value)}
          className="field-sizing-content min-h-11 w-full resize-none rounded-lg border border-transparent bg-transparent py-2 pr-9 pl-3 font-heading text-title text-balance text-foreground hover:bg-pill-track focus:border-input focus:bg-row disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Pencil
          aria-hidden="true"
          className="pointer-events-none absolute top-3.5 right-3 size-4 text-muted-foreground"
          strokeWidth={2}
        />
      </div>
      {errors.map((error) => (
        <p
          key={error.id}
          id={error.id}
          role="alert"
          className="text-caption text-destructive"
        >
          {error.text}
        </p>
      ))}
    </div>
  );
}
