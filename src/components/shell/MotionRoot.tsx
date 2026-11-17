"use client";

// Racine Motion de la coque (DESIGN.md § 7) : les animations Motion suivent prefers-reduced-motion.
import { MotionConfig } from "motion/react";

type MotionRootProps = {
  children: React.ReactNode;
};

export function MotionRoot({ children }: MotionRootProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
