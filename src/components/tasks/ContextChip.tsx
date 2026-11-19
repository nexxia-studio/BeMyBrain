"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille Espace de l'ajout rapide : menu « Aucun » puis les espaces du côté actif (Menu de Base UI :
// clavier, Échap, focus rendu à la pastille). Même motif que le filtre d'espace mobile (ContextFilterMenu).
// Couleur de l'espace (contexts.color, DESIGN.md § 2) : la pastille choisie prend le fond et le texte `chip-*`
// de son espace (contrastes ≥ 5,52:1 sur blanc) ; sans espace, le style des autres pastilles. Dans le menu,
// chaque nom est posé dans sa pastille.
import { Menu } from "@base-ui/react/menu";
import { Check, Shapes } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ContextColor } from "@/modules/core/context-colors";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipPositionerProps,
  chipTriggerClass,
} from "./chip-styles";
import { contextChipClass, contextColorClass } from "./context-chip-class";

// Valeur du choix « Aucun » (jamais un identifiant d'espace, qui est un UUID).
const NONE = "none";

type ContextChipProps = {
  /** Espaces du côté actif ; noms saisis par l'utilisateur, jamais traduits. */
  contexts: { id: string; name: string; color: ContextColor }[];
  value: string | null;
  onChange: (contextId: string | null) => void;
  disabled: boolean;
  /** Id du message d'erreur sous le champ (détail), s'il y en a un. */
  describedBy?: string;
};

export function ContextChip({
  contexts,
  value,
  onChange,
  disabled,
  describedBy,
}: ContextChipProps) {
  const t = useTranslations("tasks.quickAdd.context");
  const current = contexts.find((context) => context.id === value);

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          />
        }
        disabled={disabled}
        aria-describedby={describedBy}
        aria-label={t("menuLabel", { current: current?.name ?? t("none") })}
        className={cn(
          chipTriggerClass,
          current ? contextColorClass[current.color] : "text-muted-foreground",
        )}
      >
        <Shapes
          aria-hidden="true"
          className="size-4 shrink-0"
          strokeWidth={2}
        />
        <span className="truncate">{current?.name ?? t("label")}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          {...chipPositionerProps}
          className={chipPositionerClass}
        >
          <Menu.Popup className={chipPopupClass}>
            <Menu.RadioGroup
              value={current ? current.id : NONE}
              onValueChange={(next: unknown) =>
                onChange(next === NONE ? null : String(next))
              }
            >
              {[{ id: NONE, name: t("none"), color: null }, ...contexts].map(
                (option) => (
                  <Menu.RadioItem
                    key={option.id}
                    value={option.id}
                    closeOnClick
                    className={chipItemClass}
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
                    <span
                      className={
                        option.color === null
                          ? "min-w-0 break-words"
                          : `min-w-0 break-words ${contextChipClass(option.color)}`
                      }
                    >
                      {option.name}
                    </span>
                  </Menu.RadioItem>
                ),
              )}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
