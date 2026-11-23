import type { ContextColor } from "@/modules/core/context-colors";

// Pastille d'un espace (DESIGN.md § 2 et § 5, **Pastilles de contexte**) : fond et texte `chip-*` de sa
// couleur. Chaînes écrites en entier pour que Tailwind les trouve.
export const contextColorClass: Record<ContextColor, string> = {
  neutral: "bg-chip-neutral text-chip-neutral-foreground",
  warm: "bg-chip-warm text-chip-warm-foreground",
  indigo: "bg-chip-indigo text-chip-indigo-foreground",
};

/** Forme et taille de texte d'une pastille (espace, « Annulée », côté) : donne sa hauteur. */
export const CHIP_SHAPE_CLASSES = "rounded-full px-2.5 py-0.5 text-chip";

/** Pastille de contexte complète : forme, taille de texte, couleur. */
export function contextChipClass(color: ContextColor): string {
  return `${CHIP_SHAPE_CLASSES} ${contextColorClass[color]}`;
}
