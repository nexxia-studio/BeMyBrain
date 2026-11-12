// Curseurs nexxia-design : VARIANCE, MOTION, DENSITY fixés avec DESIGN.md (tâche 12).
// raccourci: page vide, cible de la redirection après connexion — tableau de bord bento à la tâche 15.
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <main className="flex-1 px-4">
      <h1 className="text-2xl font-semibold tracking-tight leading-tight">
        {t("title")}
      </h1>
    </main>
  );
}
