// Icônes de priorité (modèle Linear), une seule source pour la ligne, les tuiles et la pastille Priorité du
// détail. Formes distinctes à 16 px : alerte dans un carré pour urgente, barres de signal pour haute, moyenne,
// basse ; barres vides pour « Aucune » dans le menu du détail seulement (la ligne n'affiche rien pour 0).
// Toujours à l'encre (`text-foreground`) : la braise reste réservée aux erreurs et au retard (DESIGN.md § 2).
import {
  type LucideIcon,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  SquareExclamationPoint,
} from "lucide-react";

export type PriorityLevel = 0 | 1 | 2 | 3 | 4;

export const PRIORITY_ICONS: Record<PriorityLevel, LucideIcon> = {
  0: SignalZero,
  1: SquareExclamationPoint,
  2: SignalHigh,
  3: SignalMedium,
  4: SignalLow,
};

/** Priorité affichée dans une ligne de liste (1 à 4) ; 0 = aucune priorité, rien d'affiché. */
export function isRowPriority(priority: number): priority is 1 | 2 | 3 | 4 {
  return priority >= 1 && priority <= 4;
}
