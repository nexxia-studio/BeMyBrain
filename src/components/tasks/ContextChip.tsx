"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille Espace de l'ajout rapide : menu « Aucun » puis les espaces du côté actif (Menu de Base UI :
// clavier, Échap, focus rendu à la pastille). Même motif que le filtre d'espace mobile (ContextFilterMenu).
// Pas de couleur par espace : la base n'en stocke aucune (DESIGN.md § 2 prévoit neutre, chaude ou indigo par espace),
// en attente d'une décision d'Antoine ; la pastille garde le style des autres.
// raccourci: aucune couleur par espace — à brancher quand Antoine aura tranché où elle se stocke (colonne de `contexts`, choix parmi les trois `chip-*`).
import { Menu } from "@base-ui/react/menu";
import { Check, Shapes } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipTriggerClass,
} from "./chip-styles";

// Valeur du choix « Aucun » (jamais un identifiant d'espace, qui est un UUID).
const NONE = "none";

type ContextChipProps = {
  /** Espaces du côté actif ; noms saisis par l'utilisateur, jamais traduits. */
  contexts: { id: string; name: string }[];
  value: string | null;
  onChange: (contextId: string | null) => void;
  disabled: boolean;
};

export function ContextChip({
  contexts,
  value,
  onChange,
  disabled,
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
        aria-label={t("menuLabel", { current: current?.name ?? t("none") })}
        className={cn(
          chipTriggerClass,
          current ? "text-foreground" : "text-muted-foreground",
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
          sideOffset={8}
          align="start"
          className={chipPositionerClass}
        >
          <Menu.Popup className={chipPopupClass}>
            <Menu.RadioGroup
              value={current ? current.id : NONE}
              onValueChange={(next: unknown) =>
                onChange(next === NONE ? null : String(next))
              }
            >
              {[{ id: NONE, name: t("none") }, ...contexts].map((option) => (
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
                  <span className="min-w-0 break-words">{option.name}</span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
