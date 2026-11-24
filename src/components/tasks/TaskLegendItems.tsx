import { Children, type ReactNode } from "react";

type TaskLegendItemsProps = {
  /** Informations de la légende qui précèdent la priorité ; les absentes (`false`, `null`) sont ignorées. */
  children: ReactNode;
  /** Icône de priorité, `null` sans priorité. */
  priority: ReactNode;
};

/**
 * Éléments d'une légende de tâche qui passe à la ligne (ligne de liste, carte du kanban) : l'icône de priorité
 * forme un groupe insécable avec la dernière information qui la précède, pour ne jamais se retrouver seule sur
 * une ligne. Sans information avant elle, ou sans priorité : rendu tel quel, sans groupe.
 */
export function TaskLegendItems({ children, priority }: TaskLegendItemsProps) {
  const items = Children.toArray(children);
  const last = priority === null ? undefined : items.pop();

  return (
    <>
      {items}
      {last === undefined ? (
        priority
      ) : (
        // Même écart que la légende ; `min-w-0` : une information tronquée (tags, espace) le reste.
        <span
          data-legend-group=""
          className="flex min-w-0 flex-nowrap items-center gap-x-2.5"
        >
          {last}
          {priority}
        </span>
      )}
    </>
  );
}
