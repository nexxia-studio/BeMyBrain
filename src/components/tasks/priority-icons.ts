// Icônes de priorité (modèle Linear), une seule source pour la ligne, les tuiles et la pastille Priorité du
// détail. Formes distinctes à 16 px : alerte dans un carré pour urgente, barres de signal pour haute, moyenne,
// basse. Aucune icône pour 0, partout (spec, « Ligne ») : `SignalZero` se réduit à un point isolé ; la pastille
// du détail garde alors l'icône du champ (drapeau), le menu laisse la place vide.
// Toujours à l'encre (`text-foreground`) : la braise reste réservée aux erreurs et au retard (DESIGN.md § 2).
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

/** Priorité affichée dans une ligne de liste (1 à 4) ; 0 = aucune priorité, rien d'affiché. */
export function isRowPriority(priority: number): priority is PriorityLevel {
  return priority >= 1 && priority <= 4;
}
