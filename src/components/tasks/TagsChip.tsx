"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille Tags de l'ajout rapide (Popover de Base UI : clavier, Échap, focus rendu à la pastille).
// Champ de recherche (libellé visible), tags du workspace filtrés en tapant (boutons `aria-pressed`, plusieurs à la fois),
// « Créer « … » » quand le nom n'existe pas (sans casse : `findTagName`). Entrée choisit le tag tapé.
// Tags lus à la première ouverture de la pastille (`tasks.listTags`), relus après chaque ajout réussi (le
// formulaire remonte la pastille) : un ajout sans tag ne coûte aucune lecture. Lecture en échec : message, la création reste possible.
import { Popover } from "@base-ui/react/popover";
import { Check, Plus, Tag } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { runAppAction } from "@/app/(app)/tasks/actions";
import { settleAction } from "@/lib/settle-action";
import { cn } from "@/lib/utils";
import { TAG_NAME_MAX, TASK_TAGS_PER_WRITE_MAX } from "@/modules/tasks/sides";
import { findTagName, matchTagNames } from "@/modules/tasks/view";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipPositionerProps,
  chipTriggerClass,
} from "./chip-styles";

type TagsChipProps = {
  /** Tags choisis, noms tels qu'enregistrés ou tapés (jamais traduits). */
  value: string[];
  onChange: (tags: string[]) => void;
  disabled: boolean;
  /** Ouverture et fermeture de la popup (le détail enregistre à la fermeture). */
  onOpenChange?: (open: boolean) => void;
  /** Id du message d'erreur sous le champ (détail), s'il y en a un. */
  describedBy?: string;
};

type Known =
  | { state: "idle" | "loading" | "failed" }
  | {
      state: "loaded";
      names: string[];
    };

/** Noms des tags renvoyés par `tasks.listTags` (forme vérifiée : la Server Action renvoie `unknown`). */
function tagNames(result: unknown): string[] | null {
  if (!Array.isArray(result)) return null;
  const names = result.map((tag: unknown) =>
    typeof tag === "object" && tag !== null && "name" in tag
      ? tag.name
      : undefined,
  );
  return names.every((name) => typeof name === "string") ? names : null;
}

export function TagsChip({
  value,
  onChange,
  disabled,
  onOpenChange: notifyOpenChange,
  describedBy,
}: TagsChipProps) {
  const t = useTranslations("tasks.quickAdd.tags");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [known, setKnown] = useState<Known>({ state: "idle" });
  const searchId = useId();

  const loaded = known.state === "loaded" ? known.names : [];
  // Tags du workspace, plus ceux créés dans cet ajout rapide (pas encore en base).
  const all = [
    ...loaded,
    ...value.filter((name) => findTagName(loaded, name) === undefined),
  ];
  const matches = matchTagNames(all, query);
  const typed = query.trim();
  const full = value.length >= TASK_TAGS_PER_WRITE_MAX;
  const canCreate = typed !== "" && findTagName(all, typed) === undefined;
  const current = value.length > 0 ? value.join(", ") : null;

  async function load() {
    setKnown({ state: "loading" });
    const outcome = await settleAction(() =>
      runAppAction("tasks.listTags", {}),
    );
    const names =
      outcome.ok && outcome.value.ok ? tagNames(outcome.value.result) : null;
    setKnown(names ? { state: "loaded", names } : { state: "failed" });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    notifyOpenChange?.(next);
    if (next && (known.state === "idle" || known.state === "failed")) {
      void load();
    }
  }

  function toggle(name: string) {
    const chosen = findTagName(value, name);
    if (chosen !== undefined) {
      onChange(value.filter((existing) => existing !== chosen));
    } else if (!full) {
      onChange([...value, name]);
    }
    setQuery("");
  }

  function chooseTyped() {
    if (typed === "") return;
    toggle(findTagName(all, typed) ?? typed);
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
        <Tag aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
        <span className="truncate">{current ?? t("none")}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          {...chipPositionerProps}
          className={chipPositionerClass}
        >
          <Popover.Popup className={cn(chipPopupClass, "w-72 max-w-dvw")}>
            <div className="flex flex-col gap-1.5 px-3 pt-2 pb-1">
              <label htmlFor={searchId} className="text-small font-medium">
                {t("search")}
              </label>
              <input
                id={searchId}
                type="text"
                value={query}
                maxLength={TAG_NAME_MAX}
                autoComplete="off"
                enterKeyHint="done"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  chooseTyped();
                }}
                className="min-h-11 w-full rounded-lg border border-input bg-row px-3 text-base text-foreground"
              />
            </div>
            {known.state === "loading" && (
              <p className="px-3 py-2 text-small text-muted-foreground">
                {t("loading")}
              </p>
            )}
            {known.state === "failed" && (
              <p className="px-3 py-2 text-small text-destructive">
                {t("loadFailed")}
              </p>
            )}
            {full && (
              <p className="px-3 py-2 text-small text-muted-foreground">
                {t("limit", { max: TASK_TAGS_PER_WRITE_MAX })}
              </p>
            )}
            <ul className="flex flex-col">
              {matches.map((name) => {
                const selected = findTagName(value, name) !== undefined;
                return (
                  <li key={name}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      disabled={!selected && full}
                      onClick={() => toggle(name)}
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
                      <span className="min-w-0 break-words">{name}</span>
                    </button>
                  </li>
                );
              })}
              {canCreate && (
                <li>
                  <button
                    type="button"
                    disabled={full}
                    onClick={chooseTyped}
                    className={chipItemClass}
                  >
                    <Plus
                      aria-hidden="true"
                      className="size-4 shrink-0 text-link"
                      strokeWidth={2}
                    />
                    <span className="min-w-0 break-words">
                      {t("create", { name: typed })}
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
