"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// « Voir tous les espaces » de la liste vide filtrée : retire le filtre d'espace du côté actif (même
// enregistrement que le choix « tous » du filtre). Lien d'action (`text-link`), zone de 44 px ; désactivé
// pendant l'appel, message visible en cas d'échec. Next rafraîchit la route après l'écriture du cookie.
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setContextSelection } from "@/lib/preferences-actions";
import { settleAction } from "@/lib/settle-action";
import type { Side } from "@/modules/core/sides";

type ShowAllSpacesButtonProps = {
  side: Side;
};

export function ShowAllSpacesButton({ side }: ShowAllSpacesButtonProps) {
  const t = useTranslations("tasks.list");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function showAll() {
    setFailed(false);
    startTransition(async () => {
      const outcome = await settleAction(() => setContextSelection(side, null));
      if (!outcome.ok) setFailed(true);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <motion.button
        type="button"
        onClick={showAll}
        disabled={pending}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className="min-h-11 text-small font-semibold text-link hover:text-link-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t("showAllSpaces")}
      </motion.button>
      {failed && (
        <p role="alert" className="text-caption text-destructive">
          {t("showAllFailed")}
        </p>
      )}
    </div>
  );
}
