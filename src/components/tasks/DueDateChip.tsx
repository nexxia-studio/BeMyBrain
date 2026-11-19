"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille Date de l'ajout rapide (Popover de Base UI : clavier, Échap, focus rendu à la pastille).
// Raccourcis d'un tap (Aujourd'hui, Demain, Ce week-end, Semaine prochaine : `dateShortcuts`, règle du module
// tasks), puis « Choisir… » et l'heure en champs natifs (`<input type="date">` / `type="time"` : roues sur
// iOS, aucune bibliothèque de calendrier). Un raccourci ferme la popup ; un champ natif la laisse ouverte
// (sur iOS, la roue change la valeur à chaque cran).
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, Check } from "lucide-react";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { dateShortcuts, type DateShortcuts } from "@/modules/tasks/view";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipPositionerProps,
  chipTriggerClass,
} from "./chip-styles";

export type DueDate = { date: string | null; time: string | null };

const SHORTCUTS = ["today", "tomorrow", "weekend", "nextWeek"] as const;

type DueDateChipProps = {
  /** Jour courant de l'utilisateur, `YYYY-MM-DD` (`todayIn(getUserTimeZone(), now)`). */
  today: string;
  value: DueDate;
  onChange: (value: DueDate) => void;
  disabled: boolean;
  /** Ouverture et fermeture de la popup (le détail enregistre à la fermeture). */
  onOpenChange?: (open: boolean) => void;
  /** Id du message d'erreur sous le champ (détail), s'il y en a un. */
  describedBy?: string;
};

/** Jour `YYYY-MM-DD` en instant UTC, formaté en UTC : le jour affiché est celui saisi. */
function utcDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

/** Raccourci qui désigne `date` (le premier dans l'ordre affiché), ou undefined. */
function shortcutOf(
  date: string,
  shortcuts: DateShortcuts,
): (typeof SHORTCUTS)[number] | undefined {
  return SHORTCUTS.find((key) => shortcuts[key] === date);
}

export function DueDateChip({
  today,
  value,
  onChange,
  disabled,
  onOpenChange,
  describedBy,
}: DueDateChipProps) {
  const t = useTranslations("tasks.quickAdd.date");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [timeShown, setTimeShown] = useState(false);
  const timeRef = useRef<HTMLInputElement | null>(null);
  const dateId = useId();
  const timeId = useId();
  const shortcuts = dateShortcuts(today);

  const formatDay = (day: string) =>
    format.dateTime(utcDay(day), {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  let current: string | null = null;
  if (value.date !== null) {
    const shortcut = shortcutOf(value.date, shortcuts);
    const day = shortcut ? t(shortcut) : formatDay(value.date);
    current = value.time ? `${day} · ${value.time}` : day;
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function choose(date: string) {
    onChange({ date, time: value.time });
    changeOpen(false);
  }

  function changeDate(date: string) {
    // Date vidée dans le champ natif : l'heure part avec elle (pas d'heure sans date).
    onChange(date ? { date, time: value.time } : { date: null, time: null });
  }

  function clear() {
    onChange({ date: null, time: null });
    setTimeShown(false);
    changeOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger
        render={
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          />
        }
        disabled={disabled}
        aria-describedby={describedBy}
        aria-label={t("menuLabel", { current: current ?? t("none") })}
        className={cn(
          chipTriggerClass,
          current ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <CalendarDays
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={2}
        />
        <span className="truncate">{current ?? t("label")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          {...chipPositionerProps}
          className={chipPositionerClass}
        >
          <Popover.Popup className={chipPopupClass}>
            <ul className="flex flex-col">
              {SHORTCUTS.map((key) => {
                const selected = value.date === shortcuts[key];
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(shortcuts[key])}
                      className={chipItemClass}
                    >
                      <span className="flex size-4 shrink-0 items-center">
                        {selected && (
                          <Check
                            aria-hidden="true"
                            className="size-4 text-link"
                            strokeWidth={2}
                          />
                        )}
                      </span>
                      <span className="flex-1">{t(key)}</span>
                      <span className="text-caption font-normal text-muted-foreground">
                        {formatDay(shortcuts[key])}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1 flex flex-col gap-3 border-t border-border px-3 pt-3 pb-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={dateId} className="text-small font-medium">
                  {t("pick")}
                </label>
                <input
                  id={dateId}
                  type="date"
                  value={value.date ?? ""}
                  onChange={(event) => changeDate(event.target.value)}
                  className="min-h-11 rounded-lg border border-input bg-row px-3 text-base text-foreground"
                />
              </div>
              {value.date !== null &&
                (timeShown || value.time !== null ? (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={timeId} className="text-small font-medium">
                      {t("time")}
                    </label>
                    <input
                      id={timeId}
                      ref={timeRef}
                      type="time"
                      value={value.time ?? ""}
                      onChange={(event) =>
                        onChange({
                          date: value.date,
                          time: event.target.value || null,
                        })
                      }
                      className="min-h-11 rounded-lg border border-input bg-row px-3 text-base text-foreground"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTimeShown(true);
                      // Champ monté au rendu suivant : focus juste après.
                      requestAnimationFrame(() => timeRef.current?.focus());
                    }}
                    className="flex min-h-11 items-center self-start text-small font-semibold text-link"
                  >
                    {t("addTime")}
                  </button>
                ))}
              {value.date !== null && (
                <button
                  type="button"
                  onClick={clear}
                  className="flex min-h-11 items-center self-start text-small font-semibold text-link"
                >
                  {t("clear")}
                </button>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
