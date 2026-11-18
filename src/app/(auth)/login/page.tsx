// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — baseline provisoire, fixée avec DESIGN.md (tâche 12).
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/LoginForm";
import { appOrigin, returnPath } from "@/lib/auth/return-path";
import { RESET_PASSWORD_PATH } from "@/lib/auth/routes";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reset, next }, t, request] = await Promise.all([
    searchParams,
    getTranslations("auth"),
    headers(),
  ]);
  // Page d'origine après une session expirée (QA-1) : filtrée ici, revalidée par l'action signIn.
  const returnTo =
    returnPath(typeof next === "string" ? next : null, appOrigin(request)) ??
    undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="font-heading text-page-title">{t("login.title")}</h1>
      {reset === "done" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("login.resetDone")}
        </p>
      )}
      <LoginForm next={returnTo} />
      <Link
        href={RESET_PASSWORD_PATH}
        className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4"
      >
        {t("login.forgotPassword")}
      </Link>
    </main>
  );
}
