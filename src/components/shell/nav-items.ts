import { House, type LucideIcon, Settings } from "lucide-react";

import { HOME_PATH, SETTINGS_PATH } from "@/lib/auth/routes";

// Sections de la navigation : seulement celles qui existent. Chaque module ajoute la sienne à sa
// feature (la référence montre To-do, Listes, Finances… qui n'existent pas encore).
export type NavItem = {
  href: string;
  /** Clé de `shell` dans messages/*.json. */
  labelKey: "home" | "settings";
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: HOME_PATH, labelKey: "home", icon: House },
  // Dernier : de l'autre côté du bouton d'ajout dans la barre d'onglets, en bas de la barre latérale.
  { href: SETTINGS_PATH, labelKey: "settings", icon: Settings },
];

/** Vrai si `pathname` est la section ou l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
