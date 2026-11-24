"use client";

// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Groupe de choix d'un réglage de la démo du kanban : libellé visible puis pilules sur piste, motif de la bascule
// Privé / Pro (DESIGN.md § 5) : `role="group"`, boutons `aria-pressed`, actif blanc + `shadow-raised`, pression
// `scale` 0,97. Changement instantané, rien d'enregistré. Les pilules passent à la ligne sous 390 px.
// raccourci: page temporaire, retirée à la dernière tâche du plan todo-kanban.
import { motion } from "motion/react";
import { useId } from "react";

import { cn } from "@/lib/utils";

type DemoChoiceGroupProps<V extends string | number> = {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  /** Précision sous les pilules (ex. durée d'appui en ms). */
  hint?: string;
};

export function DemoChoiceGroup<V extends string | number>({
  label,
  options,
  value,
  onChange,
  hint,
}: DemoChoiceGroupProps<V>) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-small font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1 self-start rounded-full bg-pill-track p-1"
      >
        {options.map((option) => (
          <motion.button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className={cn(
              "min-h-11 rounded-full px-4 text-small font-semibold",
              option.value === value
                ? "bg-pill-active text-foreground shadow-raised"
                : "text-muted-foreground",
            )}
          >
            {option.label}
          </motion.button>
        ))}
      </div>
      {hint ? (
        <span className="text-caption text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}
