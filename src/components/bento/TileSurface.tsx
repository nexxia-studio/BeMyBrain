"use client";

// Surface en verre d'une tuile (DESIGN.md § 5). Motion n'anime que le survol (pointeur fin : Motion
// ignore le toucher), y −2, ressort sans rebond. L'enveloppe de la tuile, elle, est animée par GSAP
// (révélation, bascule) : jamais le même élément (ADR-006). Sous prefers-reduced-motion, MotionRoot coupe
// la translation.
// Premier enfant : calque du reflet (DESIGN.md § 7, ligne « Reflet »), hors champ au repos, sous le contenu
// (surface `isolate`, calque en z −1), balayé une fois par session par GSAP à la fin de la révélation
// (src/components/signature/bento-reveal.tsx). `overflow-hidden` le tient dans la tuile ; le focus visible
// des contrôles (2 px décalé de 2 px) reste dans le padding `p-tile` (18 px au moins).
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type TileSurfaceProps = {
  className: string;
  children: React.ReactNode;
};

export function TileSurface({ className, children }: TileSurfaceProps) {
  return (
    <motion.section
      whileHover={{ y: -2 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className={cn("relative isolate overflow-hidden", className)}
    >
      <div data-sheen aria-hidden="true" className="sheen" />
      {children}
    </motion.section>
  );
}
