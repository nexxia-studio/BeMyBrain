// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Corbeille `/trash` (spec todo-unifiee, « Corbeille (`/trash`) ») : corbeille de toute l'app, chaque module y
// déclare son type (`src/components/trash/trash-types.tsx`). Titre, puis une tuile de lignes, la plus récente
// d'abord. Ni filtre d'espace ni bascule de côté : tout ce qui est à la corbeille y est. Une colonne à toutes
// les largeurs (repli sous 768 px sans objet). Lecture côté serveur uniquement.
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { loadTrash } from "@/components/trash/trash-types";
import { TrashList } from "@/components/trash/TrashList";
import { requireSessionWithToken } from "@/lib/session";

export default async function TrashPage() {
  const [{ session, token }, t] = await Promise.all([
    requireSessionWithToken(),
    getTranslations("trash"),
  ]);
  const items = await loadTrash(token, session.workspaceId);

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <TrashList items={items} />
    </main>
  );
}
