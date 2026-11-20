// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Détail `/tasks/[id]` ouvert depuis la liste (navigation côté client) : route interceptée, rendue dans
// l'emplacement `@detail` du layout par-dessus la liste déjà affichée, sans la relire ni montrer de squelette.
// Rechargement ou lien profond : pas d'interception, `[id]/page.tsx` rend la liste et le détail.
import { listQuery } from "@/components/tasks/list-query";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

type TaskDetailOverListProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TaskDetailOverList({
  params,
  searchParams,
}: TaskDetailOverListProps) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  return TaskDetailPanel({ id, listQuery: listQuery(search) });
}
