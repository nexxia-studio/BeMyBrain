// Layout de `/tasks` (liste, détail) : porte le message « Tâche mise à la corbeille » + « Annuler », qui doit
// survivre à la fermeture du détail (TaskTrashProvider), autour de la liste et de l'emplacement `@detail`.
// `@detail` : détail ouvert depuis la liste, en route interceptée (`@detail/(.)[id]`), par-dessus la liste
// déjà affichée (aucun squelette à l'ouverture ni à la fermeture) ; vide sur `/tasks` (`@detail/page.tsx`).
// Ouvert directement par son adresse (rechargement, lien profond), `(list)/[id]/page.tsx` rend la liste seule et
// le détail passe par `@detail/[id]/page.tsx` : un seul emplacement porte toujours le détail.
// Liste (`page.tsx`, `[id]/page.tsx`) et son chargement dans le groupe `(list)` (BRAIN-54) : en Next 16, le
// `loading.tsx` d'un dossier enveloppe chaque emplacement de son layout ; posé ici, il s'afficherait aussi dans
// `@detail` (deux titres, deux givres). Le détail a ses propres `error.tsx` et `loading.tsx`.
// raccourci: fermer un détail ouvert par lien profond montre un squelette bref (`children` passe de
// `(list)/[id]/page` à `(list)/page`) ; l'ouverture et la fermeture depuis la liste n'en ont pas.
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
