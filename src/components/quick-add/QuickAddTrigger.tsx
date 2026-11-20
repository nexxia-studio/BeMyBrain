"use client";

// Déclencheur de l'ajout rapide (« + » de la barre d'onglets, bouton d'ajout rond de l'en-tête). Pression en
// Motion (scale 0,97, DESIGN.md § 7), coupée par MotionConfig reducedMotion="user".
import { motion } from "motion/react";

import { useOpenQuickAdd } from "./quick-add-context";

type QuickAddTriggerProps = {
  className: string;
  /** Nom accessible (bouton à icône seule). */
  label: string;
  children: React.ReactNode;
};

export function QuickAddTrigger({
  className,
  label,
  children,
}: QuickAddTriggerProps) {
  const openQuickAdd = useOpenQuickAdd();

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={openQuickAdd}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.button>
  );
}
