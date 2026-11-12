// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — baseline provisoire, fixée avec DESIGN.md (tâche 12).
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { LOGIN_PATH } from "@/lib/auth/routes";

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight leading-tight">
        {t("reset.title")}
      </h1>
      <ResetPasswordForm />
      <Link
        href={LOGIN_PATH}
        className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4"
      >
        {t("reset.backToLogin")}
      </Link>
    </main>
  );
}
