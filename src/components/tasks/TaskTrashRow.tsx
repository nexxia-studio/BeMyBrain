// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Contenu d'une tâche dans la corbeille `/trash` (type `task` de `trash-types.tsx`) : titre (deux lignes au
// plus), puis en légende la parente (sous-tâche mise à la corbeille seule), l'espace et « + n sous-tâches »
// (parente). Pas de case à cocher, pas de lien vers le détail (une tâche à la corbeille n'en a pas) ; date et
// « Restaurer » sont posés par TrashList. Sans état : rendu côté serveur par le registre.
import { CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TrashEntry } from "@/modules/tasks/view";

import { contextChipClass } from "./context-chip-class";

type TaskTrashRowProps = { item: TrashEntry };

export function TaskTrashRow({
  item: { task, subtaskCount },
}: TaskTrashRowProps) {
  const t = useTranslations("tasks");

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {/* Contenu saisi : jamais traduit. */}
      <span className="line-clamp-2 text-body break-words text-foreground">
        {task.title}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground empty:hidden">
        {task.parentTitle !== null && (
          <span className="flex min-w-0 items-center gap-1">
            <CornerDownRight
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={2}
            />
            <span className="sr-only">{t("list.parent")}</span>
            <span className="truncate">{task.parentTitle}</span>
          </span>
        )}
        {task.contextName !== null && (
          <span
            className={`truncate ${contextChipClass(task.contextColor ?? "neutral")}`}
          >
            {task.contextName}
          </span>
        )}
        {subtaskCount > 0 && (
          <span>{t("trash.subtasks", { count: subtaskCount })}</span>
        )}
      </span>
    </span>
  );
}
