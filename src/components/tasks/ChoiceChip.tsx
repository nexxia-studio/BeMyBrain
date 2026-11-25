"use client";

// Curseurs nexxia-design (spec todo-unifiee, UI) : VARIANCE 3 · MOTION 4 · DENSITY 6.
// Pastille à choix unique du détail (Statut, Priorité, Côté) : même forme et même menu que la pastille
// Espace de l'ajout rapide (Menu de Base UI : clavier, Échap, focus rendu à la pastille, coche sur le choix
// courant). Désactivée pendant l'appel ; l'erreur s'affiche sous le champ, reliée par `aria-describedby`.
import { Menu } from "@base-ui/react/menu";
import { Check, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipPositionerProps,
  chipTriggerClass,
} from "./chip-styles";

/**
 * Un choix ; `icon` (facultatif) remplace l'icône de la pastille quand il est choisi et s'affiche dans le menu.
 * Sans `icon`, la pastille garde l'icône du champ. `iconClass` : couleur de l'icône (token de la charte), dans la
 * pastille et dans le menu ; à l'encre par défaut.
 * Choix teinté (tokens de la charte, donnés par l'appelant) : `chipClass` remplace le fond et l'encre de la
 * pastille quand ce choix est le choix courant (icône et libellé à cette encre) ; `iconBadgeClass` pose l'icône du
 * menu dans un badge de ces classes (forme, fond, encre), devant le libellé resté à l'encre.
 */
export type Choice<V extends string> = {
  value: V;
  label: string;
  icon?: LucideIcon;
  iconClass?: string;
  chipClass?: string;
  iconBadgeClass?: string;
};

type ChoiceChipProps<V extends string> = {
  /** Nom accessible complet (« Statut : À faire »). */
  label: string;
  icon: LucideIcon;
  options: readonly Choice<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled: boolean;
  /** Id du message d'erreur sous le champ, s'il y en a un. */
  describedBy?: string;
};

export function ChoiceChip<V extends string>({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  disabled,
  describedBy,
}: ChoiceChipProps<V>) {
  const current = options.find((option) => option.value === value);
  const TriggerIcon = current?.icon ?? Icon;
  // Menu à icônes : un choix sans icône (Priorité « Aucune ») garde la place vide, libellés alignés.
  const iconSlot = options.some((option) => option.icon !== undefined);
  // Menu à badges : la place vide prend la largeur d'un badge (20 px) au lieu de celle d'une icône (16 px).
  const badgeSlot = options.some(
    (option) => option.iconBadgeClass !== undefined,
  );

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
        aria-label={label}
        aria-describedby={describedBy}
        className={cn(chipTriggerClass, "text-foreground", current?.chipClass)}
      >
        <TriggerIcon
          aria-hidden="true"
          className={cn("size-4 shrink-0", current?.iconClass)}
          strokeWidth={2}
        />
        <span className="truncate">{current?.label}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          {...chipPositionerProps}
          className={chipPositionerClass}
        >
          <Menu.Popup className={chipPopupClass}>
            <Menu.RadioGroup
              value={value}
              onValueChange={(next: unknown) => {
                const chosen = options.find((option) => option.value === next);
                if (chosen && chosen.value !== value) onChange(chosen.value);
              }}
            >
              {options.map((option) => (
                <Menu.RadioItem
                  key={option.value}
                  value={option.value}
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
                  {option.icon && option.iconBadgeClass !== undefined ? (
                    <span aria-hidden="true" className={option.iconBadgeClass}>
                      <option.icon
                        className="size-4 shrink-0"
                        strokeWidth={2}
                      />
                    </span>
                  ) : option.icon ? (
                    <option.icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 text-foreground",
                        option.iconClass,
                      )}
                      strokeWidth={2}
                    />
                  ) : (
                    iconSlot && (
                      <span
                        aria-hidden="true"
                        data-icon-slot=""
                        className={cn(
                          "shrink-0",
                          badgeSlot ? "size-5" : "size-4",
                        )}
                      />
                    )
                  )}
                  {option.label}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
