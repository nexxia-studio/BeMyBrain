"use client";

// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Réglage d'intensité du givre (QA-1, essai iPhone) : pilule à trois choix, comme LocalePicker. Le choix va
// dans un cookie de démo lu par le layout, puis la page est rechargée : le chargement ralenti et le givre se
// rejouent au nouveau cran. Pas d'animation : la page repart de zéro.
// raccourci: réglage de démo, retiré avec la démo à la tâche 9 du plan effets-de-verre (cookie compris).
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import {
  FROST_LEVEL_COOKIE,
  FROST_LEVEL_COOKIE_PATH,
  FROST_LEVELS,
  type FrostLevel,
} from "./frost-levels";

const LABEL_KEYS = {
  subtle: "frostSubtle",
  medium: "frostMedium",
  strong: "frostStrong",
} as const satisfies Record<FrostLevel, string>;

const COOKIE_MAX_AGE_S = 60 * 60 * 24;

type FrostLevelPickerProps = {
  /** Cran lu par le layout dans le cookie. */
  current: FrostLevel;
};

function choose(level: FrostLevel) {
  document.cookie = `${FROST_LEVEL_COOKIE}=${level}; path=${FROST_LEVEL_COOKIE_PATH}; max-age=${COOKIE_MAX_AGE_S}; samesite=lax`;
  window.location.reload();
}

export function FrostLevelPicker({ current }: FrostLevelPickerProps) {
  const t = useTranslations("glassDemo");

  return (
    <div
      role="group"
      aria-label={t("frostLevel")}
      className="grid grid-cols-3 gap-1 self-start rounded-full bg-pill-track p-1"
    >
      {FROST_LEVELS.map((level) => {
        const active = level === current;
        return (
          <button
            key={level}
            type="button"
            aria-pressed={active}
            onClick={() => choose(level)}
            className={cn(
              "min-h-11 rounded-full px-4.5 text-body font-semibold lg:px-5.5",
              active
                ? "bg-pill-active text-foreground shadow-raised"
                : "text-muted-foreground",
            )}
          >
            {t(LABEL_KEYS[level])}
          </button>
        );
      })}
    </div>
  );
}
