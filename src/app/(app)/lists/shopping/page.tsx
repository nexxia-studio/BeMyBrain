// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// `/lists/shopping` : titre puis la liste Courses rangée par rayon. Lecture côté serveur uniquement, avec la
// session (jeton et `workspaceId` de la session, jamais d'un paramètre) ; le côté Privé est gardé par le layout
// de `/lists`. Courses ne dépend pas du filtre d'espace : pas de pastille (comme `loading.tsx`).
import { getTranslations } from "next-intl/server";

import { QuickAddField } from "@/components/shopping/QuickAddField";
import { ShoppingList } from "@/components/shopping/ShoppingList";
import { PageHeader } from "@/components/shell/PageHeader";
import { requireSessionWithToken } from "@/lib/session";
import { loadShoppingList } from "@/modules/shopping/load";

export default async function ShoppingPage() {
  const [{ session, token }, t] = await Promise.all([
    requireSessionWithToken(),
    getTranslations("shopping"),
  ]);
  const list = await loadShoppingList(token, session.workspaceId);

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <ShoppingList
        aisles={list.aisles}
        order={list.order}
        quickAdd={<QuickAddField />}
      />
    </main>
  );
}
