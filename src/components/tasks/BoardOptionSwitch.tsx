"use client";

// Curseurs nexxia-design (spec todo-kanban, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Interrupteur d'une option du tableau, du modèle « Terminées » (DESIGN.md § 5) : pastille en verre posée sur le
// fond nu, `role="switch"`, piste `pill-track` bordée `input` éteinte (≥ 3:1), pleine en `primary` allumée, bouton
// blanc de 16 px. Sans état propre : valeur, attente et désactivation viennent de `BoardOptions`.
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type BoardOptionSwitchProps = {
  /** Libellé traduit par le parent. */
  label: string;
  checked: boolean;
  /** Enregistrement en cours (`aria-busy`) : l'interrupteur reste utilisable. */
  busy: boolean;
  disabled?: boolean;
  onToggle: () => void;
};

export function BoardOptionSwitch({
  label,
  checked,
  busy,
  disabled = false,
  onToggle,
}: BoardOptionSwitchProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={busy}
      disabled={disabled}
      onClick={onToggle}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="glass flex min-h-11 items-center gap-2.5 rounded-full pr-3 pl-4 text-left text-small font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-9 shrink-0 items-center rounded-full",
          checked
            ? "bg-primary p-0.5"
            : "border border-input bg-pill-track p-px",
        )}
      >
        <span
          className={cn(
            "size-4 rounded-full bg-popover shadow-raised",
            checked && "translate-x-4",
          )}
        />
      </span>
    </motion.button>
  );
}
