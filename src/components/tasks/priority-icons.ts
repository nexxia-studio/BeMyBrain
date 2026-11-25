// Icônes de priorité (modèle Linear), une seule source pour la ligne, les tuiles et la pastille Priorité du
// détail. Formes distinctes à 16 px : alerte dans un carré pour urgente, barres de signal pour haute, moyenne,
// basse. Aucune icône pour 0, partout (spec, « Ligne ») : `SignalZero` se réduit à un point isolé ; la pastille
// du détail garde alors l'icône du champ (drapeau), le menu laisse la place vide.
// Couleur (décision d'Antoine du 2026-11-25, DESIGN.md § 2 et § 5) : chaque niveau a sa teinte pastel, et l'icône
// prend l'encre du token de cette teinte (`text-priority-*-foreground`) sur son fond (`bg-priority-*`). Jamais la
// couleur seule : l'icône du niveau reste, avec son libellé pour le lecteur d'écran. La braise reste réservée aux
// erreurs et au retard.
import {
  type LucideIcon,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SquareExclamationPoint,
} from "lucide-react";

/** Niveau qui porte une icône (1 urgente à 4 basse) ; 0 = aucune priorité, sans icône. */
export type PriorityLevel = 1 | 2 | 3 | 4;

export const PRIORITY_ICONS: Record<PriorityLevel, LucideIcon> = {
  1: SquareExclamationPoint,
  2: SignalHigh,
  3: SignalMedium,
  4: SignalLow,
};

/**
 * Teinte d'un niveau : fond pastel et encre de la même teinte, pour le badge (carte, ligne, tuile) et pour la
 * pastille et le menu du détail. Chaînes écrites en entier pour que Tailwind les trouve. Aucune teinte pour 0.
 */
export const PRIORITY_TINT_CLASSES: Record<PriorityLevel, string> = {
  1: "bg-priority-urgent text-priority-urgent-foreground",
  2: "bg-priority-high text-priority-high-foreground",
  3: "bg-priority-medium text-priority-medium-foreground",
  4: "bg-priority-low text-priority-low-foreground",
};

/** Priorité affichée dans une ligne de liste (1 à 4) ; 0 = aucune priorité, rien d'affiché. */
export function isRowPriority(priority: number): priority is PriorityLevel {
  return priority >= 1 && priority <= 4;
}
