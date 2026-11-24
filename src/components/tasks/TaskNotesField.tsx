"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Champ de notes du détail (BRAIN-46, D9), commun au vrai détail (`TaskDetail`) et à la démo du kanban. Libellé
// visible au-dessus, à la taille d'un titre de section (comme « Sous-tâches »), champ de la charte (DESIGN.md § 5,
// Champs : `border-input bg-row`, `text-base` contre le zoom d'iOS).
// Vide et sans focus : replié sur une ligne de 44 px, texte d'invite « Ajouter une note » (le libellé visible reste,
// l'invite n'en tient pas lieu). Au focus, ou dès qu'il y a du texte : déplié (96 px au moins, puis la hauteur du
// contenu, `field-sizing-content`). Replié ou non, c'est le même `textarea`, toujours monté : le tap le focalise
// directement et le clavier d'iOS s'ouvre (un bouton qui monterait le champ ensuite ne l'ouvrirait pas, gotchas).
// Aucune animation : le champ change de hauteur d'un coup (animer une hauteur est exclu, anti-slop de nexxia-design).
// Sans logique de données : l'appelant tient la valeur et enregistre (au départ du champ dans le vrai détail).
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import { TASK_NOTES_MAX } from "@/modules/tasks/sides";

import type { FieldError } from "./DetailField";

type TaskNotesFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Départ du champ (enregistrement du vrai détail). */
  onBlur?: () => void;
  /** Pendant l'appel d'enregistrement. */
  disabled?: boolean;
  /** Messages déjà traduits, sous le champ. */
  errors?: FieldError[];
};

export function TaskNotesField({
  value,
  onChange,
  onBlur,
  disabled = false,
  errors = [],
}: TaskNotesFieldProps) {
  const t = useTranslations("tasks");
  const fieldId = useId();
  const [focused, setFocused] = useState(false);
  const collapsed = !focused && value.trim() === "";

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={fieldId}
        className="text-small font-semibold text-foreground"
      >
        {t("detail.notes")}
      </label>
      <textarea
        id={fieldId}
        rows={collapsed ? 1 : 3}
        value={value}
        disabled={disabled}
        maxLength={TASK_NOTES_MAX}
        placeholder={t("detail.notesPlaceholder")}
        data-collapsed={collapsed}
        aria-describedby={
          errors.length > 0
            ? errors.map((error) => error.id).join(" ")
            : undefined
        }
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        className={cn(
          "field-sizing-content w-full resize-none rounded-lg border border-input bg-row px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
          collapsed ? "min-h-11" : "min-h-24",
        )}
      />
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
