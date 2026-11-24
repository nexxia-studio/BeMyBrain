"use client";

// Lecture du détail en échec, ouvert depuis la liste (route interceptée) : erreur affichée dans la fenêtre du
// détail (BRAIN-47). Sans ce fichier, l'`error.tsx` de `/tasks` enveloppe aussi `@detail` (Next 16) et
// afficherait l'erreur de la liste sous la liste (docs/gotchas.md).
import { TaskDetailError } from "@/components/tasks/TaskDetailError";

type DetailErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function DetailOverListError({
  error,
  retry,
}: DetailErrorProps) {
  return <TaskDetailError error={error} retry={retry} />;
}
