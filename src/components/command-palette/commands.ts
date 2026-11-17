// Commandes de la palette (ADR-009), sans zod ni React : importables par un composant client.
// Navigation = raccourcis hors registre ; actions = noms et paramètres d'actions du registre, exécutées
// côté serveur par la Server Action unique runAction (validées là-bas, jamais ici).
import { Languages, type LucideIcon } from "lucide-react";

import { NAV_ITEMS, type NavItem } from "@/components/shell/nav-items";
import { type AppLocale, locales } from "@/i18n/locales";

export type NavigationCommand = {
  kind: "navigate";
  id: string;
  href: string;
  /** Clé de `shell` dans messages/*.json. */
  labelKey: NavItem["labelKey"];
  icon: LucideIcon;
};

export type ActionCommand = {
  kind: "action";
  id: string;
  /** Nom d'une action du registre (vérifié par commands.test.ts). */
  action: "core.setLocale";
  params: { locale: AppLocale };
  /** Clé de `palette.commands` dans messages/*.json. */
  labelKey: `switchLocale.${AppLocale}`;
  /** Clé de `palette.commands` : mots cherchés en plus du libellé. */
  keywordsKey: "switchLocaleKeywords";
  icon: LucideIcon;
};

export type PaletteCommand = NavigationCommand | ActionCommand;

export function paletteCommands(current: AppLocale): {
  navigation: NavigationCommand[];
  actions: ActionCommand[];
} {
  return {
    navigation: NAV_ITEMS.map(({ href, labelKey, icon }) => ({
      kind: "navigate",
      id: `navigate:${href}`,
      href,
      labelKey,
      icon,
    })),
    actions: locales
      .filter((locale) => locale !== current)
      .map((locale) => ({
        kind: "action",
        id: `core.setLocale:${locale}`,
        action: "core.setLocale",
        params: { locale },
        labelKey: `switchLocale.${locale}`,
        keywordsKey: "switchLocaleKeywords",
        icon: Languages,
      })),
  };
}

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

/** ⌘K (Mac) ou Ctrl+K (ailleurs), sans Alt ni Maj. */
export function isPaletteShortcut(event: KeyLike): boolean {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Chaque mot de la recherche figure dans le libellé ou les mots-clés (casse et accents ignorés). */
export function matchesCommand(
  command: { label: string; keywords: string },
  query: string,
): boolean {
  const haystack = normalize(`${command.label} ${command.keywords}`);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
