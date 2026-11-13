"use client";

// Surface en verre d'une tuile (DESIGN.md § 5). Motion n'anime que le survol (pointeur fin : Motion
// ignore le toucher), y −2, ressort sans rebond. L'enveloppe de la tuile, elle, est animée par GSAP
// (révélation, bascule) : jamais le même élément (ADR-006). Sous prefers-reduced-motion, MotionRoot coupe
// la translation.
import { motion } from "motion/react";

type TileSurfaceProps = {
  className: string;
  children: React.ReactNode;
};

export function TileSurface({ className, children }: TileSurfaceProps) {
  return (
    <motion.section
      whileHover={{ y: -2 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}
