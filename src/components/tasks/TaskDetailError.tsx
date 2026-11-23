"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Lecture du détail `/tasks/[id]` en échec (BRAIN-47), rendu par les `error.tsx` de `@detail` : dans la fenêtre
// du détail (panneau sur ordinateur, tiroir sur mobile, `TaskDetailSheet`), jamais sous la liste. Titre de
// section (`h2`, la page garde son `main` et son `h1`), texte fixe et traduit (jamais `error.message` ni
// `digest`), « Réessayer » et la croix « Fermer » du détail. La fenêtre est opaque (`popover`) : pas de tuile
// de verre dedans (jamais de verre sur du verre), mêmes titres et bouton que l'erreur de la liste.
// `retry()` (Next 16) refait les requêtes ; `reset` ne ferait que re-rendre (docs/gotchas.md).
// Erreur envoyée à Sentry (chargé à la demande), comme les autres pages d'erreur.
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { reportClientError } from "@/lib/sentry-client";

import { TASKS_PATH } from "../shell/nav-items";
import { listQuery } from "./list-query";
import { TaskDetailSheet } from "./TaskDetailSheet";

type TaskDetailErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export function TaskDetailError({ error, retry }: TaskDetailErrorProps) {
  const t = useTranslations("tasks.detail.error");
  const search = useSearchParams();
  // L'adresse du détail porte la requête de la liste (`/tasks/<id>?completed=1`) : la fermeture la garde.
  const closeHref = `${TASKS_PATH}${listQuery(Object.fromEntries(search))}`;

  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <TaskDetailSheet closeHref={closeHref}>
      {(closeButton) => (
        <section className="flex flex-col items-start gap-3 px-4 pb-5 lg:p-5">
          <div className="flex w-full items-center justify-between gap-3">
            <h2 className="font-heading text-title">{t("title")}</h2>
            {closeButton}
          </div>
          <p className="max-w-prose text-body text-foreground">{t("body")}</p>
          <motion.button
            type="button"
            onClick={() => retry()}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            className="min-h-11 rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground"
          >
            {t("retry")}
          </motion.button>
        </section>
      )}
    </TaskDetailSheet>
  );
}
