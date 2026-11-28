import {
  House,
  ListChecks,
  ListTodo,
  type LucideIcon,
  Settings,
} from "lucide-react";

import { HOME_PATH, SETTINGS_PATH } from "@/lib/auth/routes";
import type { Side } from "@/modules/core/sides";

/** Liste des tâches (todo-unifiee). */
export const TASKS_PATH = "/tasks";
/**
 * Corbeille de toute l'app (todo-unifiee, décision d'Antoine du 2026-11-19) : hors de `/tasks/…`, pour que le
 * détail `/tasks/[id]` s'ouvre en route interceptée par-dessus la liste. Pas d'entrée de navigation : lien en
 * bas de la liste et commande de palette.
 */
export const TRASH_PATH = "/trash";
/** Listes (Courses, puis Wishlist et Bucket List) : côté Privé seulement (spec listes, Q3). */
export const LISTS_PATH = "/lists";

// Sections de la navigation : seulement celles qui existent. Chaque module ajoute la sienne à sa
// feature (la référence montre To-do, Listes, Finances… qui n'existent pas encore).
export type NavItem = {
  href: string;
  /** Clé de `shell` dans messages/*.json. */
  labelKey: "home" | "tasks" | "lists" | "settings";
  icon: LucideIcon;
  /** Côtés où la section est proposée ; absent = les deux. */
  sides?: readonly Side[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: HOME_PATH, labelKey: "home", icon: House },
  // Onglet mobile à gauche du « + » (spec todo-unifiee, « Liste »).
  { href: TASKS_PATH, labelKey: "tasks", icon: ListTodo },
  { href: LISTS_PATH, labelKey: "lists", icon: ListChecks, sides: ["private"] },
  // Toujours en dernier : les sections des modules s'insèrent avant. Barre latérale : sous les sections,
  // au-dessus de la déconnexion. Barre d'onglets : dans la seconde moitié, à droite du bouton d'ajout.
  { href: SETTINGS_PATH, labelKey: "settings", icon: Settings },
];

/** Vrai si `pathname` est la section ou l'une de ses sous-pages. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sections proposées sur un côté (Privé ou Pro). */
export function navItemsFor(side: Side): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.sides || item.sides.includes(side));
}
