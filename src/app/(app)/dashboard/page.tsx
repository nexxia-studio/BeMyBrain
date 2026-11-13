// Curseurs nexxia-design : VARIANCE, MOTION, DENSITY fixés avec DESIGN.md (tâche 12).
// raccourci: page réduite au titre et au workspace résolu (preuve de la tâche 11) — tableau de bord bento à la tâche 15.
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shell/PageHeader";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  // Mémoïsée par requête : le layout l'a déjà appelée, pas de seconde vérification.
  const [session, t] = await Promise.all([
    requireSession(),
    getTranslations("dashboard"),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-1">
      <PageHeader title={t("title")} />
      <p className="text-sm text-muted-foreground">
        {t.rich("workspace", {
          // Nom saisi par l'utilisateur : affiché tel quel, jamais traduit.
          name: () => (
            <span data-testid="workspace-name" className="text-foreground">
              {session.workspaceName}
            </span>
          ),
        })}
      </p>
    </main>
  );
}
