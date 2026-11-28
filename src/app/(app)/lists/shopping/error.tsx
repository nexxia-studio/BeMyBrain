"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Erreur de lecture de `/lists/shopping` : dans la coque, titre de page puis une tuile qui dit ce qui s'est
// passé et « Réessayer ». `retry()` (Next 16) refait les requêtes ; `reset` ne ferait que re-rendre
// (docs/gotchas.md). Texte fixe et traduit : jamais `error.message` ni `digest`. Erreur envoyée à Sentry.
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { reportClientError } from "@/lib/sentry-client";

type ShoppingErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ShoppingError({ error, retry }: ShoppingErrorProps) {
  const t = useTranslations("shopping");

  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <h1 className="font-heading text-page-title">{t("title")}</h1>
      <section className="glass flex w-full max-w-3xl flex-col items-start gap-3 rounded-tile p-tile">
        <h2 className="font-heading text-title">{t("error.title")}</h2>
        <p className="max-w-prose text-body text-foreground">
          {t("error.body")}
        </p>
        <motion.button
          type="button"
          onClick={() => retry()}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="min-h-11 rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground"
        >
          {t("error.retry")}
        </motion.button>
      </section>
    </main>
  );
}
