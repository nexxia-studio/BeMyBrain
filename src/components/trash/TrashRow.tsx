"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Ligne de la corbeille, tous types : contenu du type (titre, légende), date de mise à la corbeille, bouton
// « Restaurer » à droite (zone 44 px, lien d'action `text-link`). Une ligne n'est pas cochable.
// Restaurer : l'action déclarée par le type, par le registre (`runAppAction`, origine `app`). Pas d'optimiste :
// bouton désactivé avec libellé d'attente pendant l'appel ; la ligne sort (TrashList) quand le rendu serveur ne
// la contient plus. Échec dans la ligne : code traduit (`tasks.errors.*`, seuls codes que `runAppAction`
// transmet), sinon message générique.
import { motion } from "motion/react";
import { useFormatter, useNow, useTimeZone, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { TaskErrorCode } from "@/modules/tasks/errors";

import { type TrashItem, trashDateFormat } from "./trash-item";
import {
  TRASH_ROW_CLASSES,
  TRASH_ROW_CONTENT_CLASSES,
  TRASH_ROW_DATE_TEXT,
  TRASH_ROW_LINE_CLASSES,
} from "./trash-list-layout";

type TrashRowProps = { item: TrashItem };

type RestoreFailure = { code?: TaskErrorCode } | null;

export function TrashRow({ item }: TrashRowProps) {
  const t = useTranslations("trash");
  const tTasks = useTranslations("tasks");
  const format = useFormatter();
  const now = useNow();
  const timeZone = useTimeZone();
  const contentId = useId();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<RestoreFailure>(null);

  function restore() {
    if (pending) return;
    setFailure(null);
    startTransition(async () => {
      const outcome = await settleAction(() =>
        runAppAction(item.restore.action, item.restore.params),
      );
      if (outcome.ok && outcome.value.ok) return;
      setFailure({
        code: outcome.ok && !outcome.value.ok ? outcome.value.code : undefined,
      });
    });
  }

  return (
    <div className={TRASH_ROW_CLASSES}>
      <div className={TRASH_ROW_LINE_CLASSES}>
        <div id={contentId} className={TRASH_ROW_CONTENT_CLASSES}>
          {item.row}
          <time
            dateTime={item.deletedAt.toISOString()}
            className={cn(TRASH_ROW_DATE_TEXT, "text-muted-foreground")}
          >
            {t("trashedOn", {
              date: format.dateTime(
                item.deletedAt,
                trashDateFormat(
                  item.deletedAt,
                  now,
                  timeZone ?? getUserTimeZone(),
                ),
              ),
            })}
          </time>
        </div>
        <motion.button
          type="button"
          disabled={pending}
          aria-describedby={contentId}
          onClick={restore}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          className="min-h-11 shrink-0 rounded-full px-3 text-small font-semibold text-link hover:text-link-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t("restoring") : t("restore")}
        </motion.button>
      </div>
      {failure !== null && (
        <p role="alert" className="px-3.5 pb-2.5 text-caption text-destructive">
          {failure.code !== undefined
            ? tTasks(`errors.${failure.code}`)
            : t("restoreFailed")}
        </p>
      )}
    </div>
  );
}
