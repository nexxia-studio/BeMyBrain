"use client";

// Bouton d'une pilule à choix (filtre d'espace) : actif = fond blanc + shadow-raised (DESIGN.md § 2).
// Motion pour la pression seulement (DESIGN.md § 7).
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type PillButtonProps = {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  /** Forme propre à un emplacement (ex. ligne pleine largeur dans la barre latérale). */
  className?: string;
};

export function PillButton({
  active,
  onPress,
  children,
  className,
}: PillButtonProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={cn(
        "min-h-11 rounded-full px-4 text-small font-semibold",
        active
          ? "bg-pill-active text-foreground shadow-raised"
          : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
