// Curseurs nexxia-design (DESIGN.md § 1, app) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Badge de priorité d'une légende (carte du kanban, ligne de liste, ligne de tuile ; DESIGN.md § 5, **Priorité**) :
// carré arrondi de 20 px au fond teinté du niveau, icône du niveau à l'encre de la teinte, libellé du niveau pour
// le lecteur d'écran. Seul rendu du badge : la couleur ne porte jamais l'information seule (icône toujours là).
// Rien pour 0 (ni pour une valeur hors de 1 à 4).
// Hauteurs : `-my-0.5` ramène la place du badge à 16 px, celle de l'icône qu'il remplace. Une légende sans
// pastille (18,2 px) ou calée sur une pastille (19,6 px, `task-list-layout.ts`) garde ainsi sa hauteur au
// centième de pixel ; le badge dépasse de 0,2 à 0,9 px dans l'écart entre le titre et la légende.
import { useTranslations } from "next-intl";

import {
  isRowPriority,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_ICONS,
  PRIORITY_TINT_CLASSES,
} from "./priority-icons";

type PriorityBadgeProps = {
  /** Priorité de la tâche : 1 urgente à 4 basse ; 0 = aucune, rien d'affiché. */
  priority: number;
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const t = useTranslations("tasks.list.priority");
  if (!isRowPriority(priority)) return null;
  const Icon = PRIORITY_ICONS[priority];

  return (
    <span
      className={`-my-0.5 ${PRIORITY_BADGE_CLASSES} ${PRIORITY_TINT_CLASSES[priority]}`}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
      <span className="sr-only">{t(`${priority}`)}</span>
    </span>
  );
}
