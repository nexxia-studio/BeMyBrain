// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// `/tasks/[id]` au chargement complet (rechargement, lien profond), emplacement `children` : la liste seule. Le
// détail est rendu au-dessus par l'emplacement `@detail` (`@detail/[id]`), et par la route interceptée
// `@detail/(.)[id]` pour une navigation côté client : un seul emplacement porte toujours le détail, jamais deux
// panneaux superposés après un lien vers la parente ou une sous-tâche.
import TasksPage from "../page";

type TaskPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function TaskPage({ searchParams }: TaskPageProps) {
  return <TasksPage searchParams={searchParams} />;
}
