// Layout de `/tasks` (liste, détail) : porte le message « Tâche mise à la corbeille » + « Annuler », qui doit
// survivre à la fermeture du détail (TaskTrashProvider), autour de la liste et de l'emplacement `@detail`.
// `@detail` : détail ouvert depuis la liste, en route interceptée (`@detail/(.)[id]`), par-dessus la liste
// déjà affichée (aucun squelette à l'ouverture ni à la fermeture) ; vide sur `/tasks` (`@detail/page.tsx`).
// Ouvert directement par son adresse (rechargement, lien profond), le détail est rendu par `[id]/page.tsx` et
// l'emplacement reste vide (`@detail/default.tsx`).
import { TaskTrashProvider } from "@/components/tasks/TaskTrashProvider";

export default function TasksLayout({
  children,
  detail,
}: Readonly<{ children: React.ReactNode; detail: React.ReactNode }>) {
  return (
    <TaskTrashProvider>
      {children}
      {detail}
    </TaskTrashProvider>
  );
}
