"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Filtre d'espace sous 1024 px (DESIGN.md § 5) : une pastille à côté du titre de page, qui ouvre un menu
// « tous » puis chaque espace du côté actif (Privé ou Pro, BRAIN-30). Menu de Base UI (déjà installé,
// primitive de shadcn base-nova) : clavier, Échap, focus rendu à la pastille, aria-expanded.
// Pastille en verre (posée sur le fond nu, DESIGN.md § 8 déc. 6) ; menu opaque (`popover`, jamais de verre
// sur du verre). Changement instantané (geste répété) ; seul le menu apparaît en fondu court.
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { setContextSelection } from "@/lib/preferences-actions";
import type { Side } from "@/modules/core/schemas";

import { PreferenceStatus } from "./PreferenceStatus";
import { useOptimisticPreference } from "./use-optimistic-preference";

// Valeur du choix « tous » dans le groupe radio (jamais un identifiant d'espace, qui est un UUID).
const ALL = "all";

type ContextOption = {
  id: string;
  /** Saisi par l'utilisateur : affiché tel quel, jamais traduit. */
  name: string;
};

type ContextFilterMenuProps = {
  /** Côté actif : la sélection est mémorisée par côté. */
  side: Side;
  contexts: ContextOption[];
  /** Espaces retenus (lus dans bmb_contexts_<côté> par le serveur) ; tous = aucun filtre. */
  selected: string[];
};

export function ContextFilterMenu({
  side,
  contexts,
  selected,
}: ContextFilterMenuProps) {
  const t = useTranslations("shell.contexts");
  const allIds = contexts.map((context) => context.id);
  const { shown, pending, failed, update } = useOptimisticPreference(
    selected,
    (ids: string[]) =>
      setContextSelection(side, ids.length === allIds.length ? null : ids),
  );
  const all = shown.length === contexts.length;
  const value = all ? ALL : shown[0];
  const allLabel = t("all", { count: contexts.length });
  const current = all
    ? allLabel
    : (contexts.find((context) => context.id === value)?.name ?? allLabel);

  function choose(next: unknown) {
    if (next === value) return;
    update(next === ALL ? allIds : [String(next)]);
  }

  const itemClass =
    "flex min-h-11 cursor-default items-center gap-2.5 rounded-md px-3 text-body font-semibold text-foreground outline-none select-none data-highlighted:bg-pill-track";

  return (
    <div className="relative">
      <Menu.Root>
        <Menu.Trigger
          aria-label={t("menuLabel", { current })}
          aria-busy={pending}
          className="glass flex min-h-11 max-w-full items-center gap-1.5 rounded-full pr-3 pl-4 text-small font-semibold text-foreground"
        >
          <span className="truncate">{current}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0"
            strokeWidth={2}
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            sideOffset={8}
            align="start"
            className="z-(--z-overlay) outline-none"
          >
            <Menu.Popup className="min-w-48 rounded-lg bg-popover p-1 text-popover-foreground shadow-glass outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0">
              <Menu.RadioGroup value={value} onValueChange={choose}>
                {[{ id: ALL, name: allLabel }, ...contexts].map((option) => (
                  <Menu.RadioItem
                    key={option.id}
                    value={option.id}
                    closeOnClick
                    className={itemClass}
                  >
                    <span className="flex size-4 shrink-0 items-center">
                      <Menu.RadioItemIndicator>
                        <Check
                          aria-hidden="true"
                          className="size-4 text-link"
                          strokeWidth={2}
                        />
                      </Menu.RadioItemIndicator>
                    </span>
                    {option.name}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <PreferenceStatus failed={failed} className="left-0" />
    </div>
  );
}
