import { House, type LucideIcon } from "lucide-react";

import { HOME_PATH } from "@/lib/auth/routes";

// Sections de la navigation : seulement celles qui existent. Chaque module ajoute la sienne à sa
// feature (la référence montre To-do, Listes, Finances… qui n'existent pas encore).
export type NavItem = {
  href: string;
  /** Clé de `shell` dans messages/*.json. */
  labelKey: "home";
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: HOME_PATH, labelKey: "home", icon: House },
];

/** Vrai si `pathname` est la section ou l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
