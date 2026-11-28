"use client";

// Curseurs nexxia-design (spec listes, UI) : VARIANCE 3 · MOTION 3 · DENSITY 6.
// Menu de la ligne d'un article (spec « Changer un article de rayon », « Renommer », « Supprimer ») : bouton
// « … » de 44 px à droite de la ligne (hors du bouton qui coche), menu de Base UI opaque comme les autres
// (placement et styles de `chip-styles`). Changer de rayon et Renommer ouvrent une feuille ; Supprimer remet
// l'article à l'appelant (`onRemove`), qui gère le délai d'« Annuler » (aucun appel serveur ici).
// Les feuilles sont montées hors du menu : le menu se ferme, la feuille s'ouvre. `finalFocus={false}` sur le
// menu : sinon il rendrait le focus au bouton « … » en même temps que la feuille le prend ; la feuille le rend
// elle-même au bouton à sa fermeture.
import { Menu } from "@base-ui/react/menu";
import { ArrowRightLeft, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { ShoppingItem } from "@/modules/shopping/list-view";

import {
  chipItemClass,
  chipPopupClass,
  chipPositionerClass,
  chipPositionerProps,
} from "../tasks/chip-styles";
import { MoveAisleSheet } from "./MoveAisleSheet";
import { RenameItemSheet } from "./RenameItemSheet";

type ItemMenuProps = {
  item: ShoppingItem;
  /** Suppression demandée : l'appelant masque l'article et laisse 5 s pour « Annuler ». */
  onRemove: (item: ShoppingItem) => void;
};

export function ItemMenu({ item, onRemove }: ItemMenuProps) {
  const t = useTranslations("shopping.itemMenu");
  const [sheet, setSheet] = useState<"move" | "rename" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={triggerRef}
          aria-label={t("trigger", { label: item.label })}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Ellipsis aria-hidden="true" className="size-5" strokeWidth={2} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            {...chipPositionerProps}
            align="end"
            className={chipPositionerClass}
          >
            <Menu.Popup
              className={chipPopupClass}
              finalFocus={sheet === null ? undefined : false}
            >
              <Menu.Item
                className={chipItemClass}
                onClick={() => setSheet("move")}
              >
                <ArrowRightLeft
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  strokeWidth={2}
                />
                {t("moveAisle")}
              </Menu.Item>
              <Menu.Item
                className={chipItemClass}
                onClick={() => setSheet("rename")}
              >
                <Pencil
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  strokeWidth={2}
                />
                {t("rename")}
              </Menu.Item>
              <Menu.Item
                className={chipItemClass}
                onClick={() => onRemove(item)}
              >
                <Trash2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-destructive"
                  strokeWidth={2}
                />
                {t("remove")}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <MoveAisleSheet
        item={item}
        open={sheet === "move"}
        onOpenChange={(open) => setSheet(open ? "move" : null)}
        returnFocusRef={triggerRef}
      />
      <RenameItemSheet
        item={item}
        open={sheet === "rename"}
        onOpenChange={(open) => setSheet(open ? "rename" : null)}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
