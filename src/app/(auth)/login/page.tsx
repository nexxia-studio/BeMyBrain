// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — baseline provisoire, fixée avec DESIGN.md (tâche 12).
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/components/auth/LoginForm";
import { RESET_PASSWORD_PATH } from "@/lib/auth/routes";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reset }, t] = await Promise.all([
    searchParams,
    getTranslations("auth"),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="font-heading text-page-title">
        {t("login.title")}
      </h1>
      {reset === "done" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("login.resetDone")}
        </p>
      )}
      <LoginForm />
      <Link
        href={RESET_PASSWORD_PATH}
        className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4"
      >
        {t("login.forgotPassword")}
      </Link>
    </main>
  );
}
