"use client";

// Déclencheur de la palette (recherche ⌘K et boutons d'ajout de la coque). Pression en Motion
// (scale 0,97, DESIGN.md § 7), coupée par MotionConfig reducedMotion="user".
import { motion } from "motion/react";

import { useOpenPalette } from "./palette-context";

type PaletteTriggerProps = {
  className: string;
  /** Nom accessible quand le bouton n'a pas de texte visible (icône seule). */
  label?: string;
  children: React.ReactNode;
};

export function PaletteTrigger({
  className,
  label,
  children,
}: PaletteTriggerProps) {
  const openPalette = useOpenPalette();

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={openPalette}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.button>
  );
}
