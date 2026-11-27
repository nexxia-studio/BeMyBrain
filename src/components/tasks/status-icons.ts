// Icônes de statut (BRAIN-46, D9), une seule source pour la pastille Statut du détail et son menu (vrai détail et
// démo du kanban). Une forme par catégorie, toutes sur le même cercle, distinctes à 16 px : pointillé (à
// planifier), vide (à faire), point au centre (en cours), coche (terminée), croix (annulée).
// Couleur, tokens de DESIGN.md § 2 seulement : l'accent indigo (`link`, celui de l'onglet actif et des icônes
// d'état vide) pour ce qui avance ou a abouti ; l'encre pour « à faire » ; l'encre secondaire pour ce qui n'est pas
// engagé ou est abandonné. La braise reste le texte du retard et des erreurs ; les statuts n'en portent pas. Sur `secondary` posé sur
// `popover` : indigo profond ≥ 7,42:1, encre secondaire 6,83:1 (seuil d'une icône : 3:1).
import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  type LucideIcon,
} from "lucide-react";

import type { StatusCategory } from "@/modules/tasks/sides";

export const STATUS_ICONS: Record<
  StatusCategory,
  { icon: LucideIcon; iconClass: string }
> = {
  backlog: { icon: CircleDashed, iconClass: "text-muted-foreground" },
  unstarted: { icon: Circle, iconClass: "text-foreground" },
  started: { icon: CircleDot, iconClass: "text-link" },
  completed: { icon: CircleCheck, iconClass: "text-link" },
  canceled: { icon: CircleX, iconClass: "text-muted-foreground" },
};
