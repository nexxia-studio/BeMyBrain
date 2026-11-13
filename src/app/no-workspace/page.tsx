// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — baseline provisoire, fixée avec DESIGN.md (tâche 12).
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { signOut } from "@/lib/auth/actions";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { getSession } from "@/lib/auth/server";

// Hors du groupe (app) : son layout appelle requireSession, qui renvoie ici sans workspace (boucle).
// Aucune donnée lue ni créée : session seulement, puis message et déconnexion.
export default async function NoWorkspacePage() {
  const [session, t] = await Promise.all([
    getSession(),
    getTranslations("noWorkspace"),
  ]);
  if (!session) redirect(LOGIN_PATH);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="font-heading text-page-title">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <form action={signOut} className="self-start">
        <SignOutButton />
      </form>
    </main>
  );
}
