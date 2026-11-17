"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Choix de la langue (ADR-007) : pilule à deux choix, comme la bascule Privé / Pro (DESIGN.md § 5), mais
// sans affichage optimiste. La langue est une donnée du membre, pas une préférence d'affichage : les deux
// choix sont désactivés pendant l'enregistrement (frontend.md « États »), puis la route rafraîchie
// rend toute l'interface dans la nouvelle langue. Motion pour la pression seulement.
// Noms de langue écrits dans leur propre langue, identiques en fr et en.
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { setLocale } from "@/app/(app)/settings/actions";
import { type AppLocale, locales } from "@/i18n/locales";
import { cn } from "@/lib/utils";

type LocalePickerProps = {
  /** Langue rendue par le serveur. */
  locale: AppLocale;
};

export function LocalePicker({ locale }: LocalePickerProps) {
  const t = useTranslations("settings.language");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function choose(next: AppLocale) {
    if (next === locale) return;
    setFailed(false);
    startTransition(async () => {
      try {
        await setLocale(next);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label={t("title")}
        aria-busy={pending}
        className="grid grid-cols-2 gap-1 self-start rounded-full bg-pill-track p-1"
      >
        {locales.map((value) => {
          const active = value === locale;
          return (
            <motion.button
              key={value}
              type="button"
              lang={value}
              aria-pressed={active}
              disabled={pending}
              onClick={() => choose(value)}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className={cn(
                "min-h-11 rounded-full px-4.5 text-body font-semibold disabled:cursor-not-allowed disabled:opacity-60 lg:px-5.5",
                active
                  ? "bg-pill-active text-foreground shadow-raised"
                  : "text-muted-foreground",
              )}
            >
              {t(value)}
            </motion.button>
          );
        })}
      </div>
      <p role="status" className="text-small font-medium text-destructive">
        {failed ? t("error") : null}
      </p>
    </div>
  );
}
