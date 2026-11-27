// Icônes de priorité (modèle Linear), une seule source pour la ligne, les tuiles et la pastille Priorité du
// détail. Formes distinctes à 16 px : alerte dans un carré pour urgente, barres de signal pour haute, moyenne,
// basse. Aucune icône pour 0, partout (spec, « Ligne ») : `SignalZero` se réduit à un point isolé ; la pastille
// du détail garde alors l'icône du champ (drapeau), le menu laisse la place vide.
// Couleur (décisions d'Antoine du 2026-11-25, DESIGN.md § 2 et § 5) : échelle rouge, orangé, jaune, vert, en pastel ;
// l'icône prend l'encre du token de sa teinte (`text-priority-*-foreground`) sur son fond (`bg-priority-*`). Jamais
// la couleur seule (rouge et vert se confondent pour certains) : l'icône du niveau reste, avec son libellé pour le
// lecteur d'écran. La braise reste le texte du retard et des erreurs, sans fond ; le rouge d'« Urgente » est un
// badge teinté à icône.
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

/**
 * Forme du badge de priorité d'une carte, d'une ligne ou d'une tuile : carré arrondi de 20 px, icône seule (16 px),
 * sans libellé visible. À 8 px de rayon sur 20 px, il est presque rond : ce qui le sépare d'une pastille d'espace
 * (l'orangé de « Haute » voisine la pastille chaude), c'est l'icône sans nom contre le nom sans icône. Même hauteur
 * qu'une pastille. Forme validée par Antoine sur iPhone le 2026-11-26 (DESIGN.md § 5). Rendu : `PriorityBadge`.
 */
export const PRIORITY_BADGE_CLASSES =
  "flex size-5 shrink-0 items-center justify-center rounded-sm";

/** Priorité affichée dans une ligne de liste (1 à 4) ; 0 = aucune priorité, rien d'affiché. */
export function isRowPriority(priority: number): priority is PriorityLevel {
  return priority >= 1 && priority <= 4;
}

/**
 * Habillage d'un choix de la pastille Priorité du détail (`ChoiceChip`, vrai détail et démo), à étaler dans le
 * choix : icône du niveau, pastille au fond et à l'encre de la teinte quand il est choisi, badge teinté devant le
 * libellé dans le menu. Rien pour 0 : pastille ordinaire à l'icône du champ, place vide dans le menu.
 */
export function priorityChoiceStyle(priority: number): {
  icon?: LucideIcon;
  chipClass?: string;
  iconBadgeClass?: string;
} {
  if (!isRowPriority(priority)) return {};
  const tint = PRIORITY_TINT_CLASSES[priority];
  return {
    icon: PRIORITY_ICONS[priority],
    chipClass: tint,
    iconBadgeClass: `${PRIORITY_BADGE_CLASSES} ${tint}`,
  };
}
