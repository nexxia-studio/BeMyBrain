"use client";

// Curseurs nexxia-design : VARIANCE 2 · MOTION 1 · DENSITY 3 — baseline provisoire, fixée avec DESIGN.md (tâche 12).
// Mobile d'abord : une colonne centrée, pleine largeur à 390 px, plafonnée à max-w-sm au-delà (pas de multi-colonnes).
import { useTranslations } from "next-intl";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Erreur d'un segment (ex. Neon Auth indisponible, AuthUnavailableError). Texte fixe et traduit :
 * jamais `error.message` ni `digest`, qui peuvent porter un détail interne.
 */
export default function ErrorPage({ retry }: ErrorPageProps) {
  const t = useTranslations("errors");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight leading-tight">
        {t("title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 self-start rounded-lg px-4 text-sm font-medium underline underline-offset-4"
      >
        {t("retry")}
      </button>
    </main>
  );
}
