// Commandes de la palette (ADR-009), sans zod ni React : importables par un composant client.
// Navigation = raccourcis hors registre ; actions = noms et paramètres d'actions du registre, exécutées
// côté serveur par la Server Action unique runAction (validées là-bas, jamais ici) ; ajout rapide = ouvre la
// coque d'ajout rapide. Groupes dans l'ordre d'affichage : Tâches (saisie libre → « Ajouter la tâche « … » »
// en premier, spec todo-unifiee « Palette »), Aller à, Actions.
import {
  Languages,
  ListTodo,
  type LucideIcon,
  Plus,
  SquarePen,
  Trash2,
} from "lucide-react";

import {
  type NavItem,
  navItemsFor,
  TASKS_PATH,
  TRASH_PATH,
} from "@/components/shell/nav-items";
import { type AppLocale, locales } from "@/i18n/locales";
import type { CurrentScope } from "@/lib/context-filter";
import type { Side } from "@/modules/core/sides";
import { TASK_TITLE_MAX } from "@/modules/tasks/sides";

/** Liste des tâches et corbeille de l'app (pages des tâches 14 et 16 du plan todo-unifiee). */
export { TASKS_PATH, TRASH_PATH };

/** Côté et espace courants de la coque : la tâche ajoutée depuis la palette les prend (comme l'ajout rapide). */
export type PaletteScope = CurrentScope;

/** Clés de `palette.commands` des commandes des tâches. */
type TaskCommandKey = "newTask" | "openTodo" | "openTrash";

export type NavigationCommand = {
  kind: "navigate";
  id: string;
  href: string;
  icon: LucideIcon;
} & (
  | {
      /** Clé de `shell` dans messages/*.json. */
      labelKey: NavItem["labelKey"];
      keywordsKey?: undefined;
    }
  | {
      /** Clé de `palette.commands` dans messages/*.json. */
      labelKey: Exclude<TaskCommandKey, "newTask">;
      /** Clé de `palette.commands` : mots cherchés en plus du libellé. */
      keywordsKey: "openTodoKeywords" | "openTrashKeywords";
    }
);

export type QuickAddCommand = {
  kind: "quickAdd";
  id: string;
  /** Clé de `palette.commands`. */
  labelKey: "newTask";
  keywordsKey: "newTaskKeywords";
  icon: LucideIcon;
};

type SetLocaleCommand = {
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

type AddTaskCommand = {
  kind: "action";
  id: string;
  action: "tasks.create";
  params: { title: string; side: Side; context?: string };
  /** Clé de `palette.commands`, avec `{title}`. */
  labelKey: "addTask";
  keywordsKey?: undefined;
  /** Texte saisi (sans espaces autour), titre de la tâche. */
  title: string;
  icon: LucideIcon;
};

export type ActionCommand = SetLocaleCommand | AddTaskCommand;

export type PaletteCommand =
  NavigationCommand | QuickAddCommand | ActionCommand;

export type PaletteGroupKey = "tasks" | "navigation" | "actions";

export type PaletteCommandGroup = {
  value: PaletteGroupKey;
  commands: PaletteCommand[];
};

/** « Ajouter la tâche « … » » pour la saisie courante ; rien sans saisie ou au-delà de la longueur admise. */
function addTaskCommand(
  query: string,
  scope: PaletteScope,
): AddTaskCommand | null {
  const title = query.trim();
  if (title === "" || title.length > TASK_TITLE_MAX) return null;
  const context = scope.contexts.find((c) => c.id === scope.contextId);
  return {
    kind: "action",
    id: "tasks.create",
    action: "tasks.create",
    params: {
      title,
      side: scope.side,
      ...(context && { context: context.name }),
    },
    labelKey: "addTask",
    title,
    icon: Plus,
  };
}

export function paletteGroups(
  current: AppLocale,
  { query, scope }: { query: string; scope: PaletteScope },
): PaletteCommandGroup[] {
  const addTask = addTaskCommand(query, scope);
  return [
    {
      value: "tasks",
      commands: [
        ...(addTask ? [addTask] : []),
        {
          kind: "quickAdd",
          id: "quickAdd:task",
          labelKey: "newTask",
          keywordsKey: "newTaskKeywords",
          icon: SquarePen,
        },
        {
          kind: "navigate",
          id: `navigate:${TASKS_PATH}`,
          href: TASKS_PATH,
          labelKey: "openTodo",
          keywordsKey: "openTodoKeywords",
          icon: ListTodo,
        },
        {
          kind: "navigate",
          id: `navigate:${TRASH_PATH}`,
          href: TRASH_PATH,
          labelKey: "openTrash",
          keywordsKey: "openTrashKeywords",
          icon: Trash2,
        },
      ],
    },
    {
      value: "navigation",
      // Sans la To-do : « Ouvrir la to-do » du groupe Tâches y mène déjà (pas de doublon).
      commands: navItemsFor(scope.side)
        .filter(({ href }) => href !== TASKS_PATH)
        .map(
        ({ href, labelKey, icon }) => ({
          kind: "navigate",
          id: `navigate:${href}`,
          href,
          labelKey,
          icon,
        }),
      ),
    },
    {
      value: "actions",
      commands: locales
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
    },
  ];
}

/**
 * Place de « Ajouter la tâche « … » » (spec todo-unifiee, « Palette ») : premier élément quand aucune autre
 * commande ne correspond à la saisie, sinon juste après la dernière commande correspondante. L'Autocomplete
 * de Base UI surligne toujours le premier élément : une commande trouvée passe donc avant l'ajout.
 */
export function arrangeAddTask<
  Item extends { label: string; keywords: string },
>(
  groups: { value: PaletteGroupKey; items: Item[] }[],
  query: string,
  isAddTask: (item: Item) => boolean,
): { value: PaletteGroupKey; items: Item[] }[] {
  const addTask = groups.flatMap((g) => g.items).find(isAddTask);
  const lastMatching = groups.findLastIndex((g) =>
    g.items.some((item) => !isAddTask(item) && matchesCommand(item, query)),
  );
  if (!addTask || lastMatching === -1) return groups;
  return groups.map((group, index) => {
    const items = group.items.filter((item) => !isAddTask(item));
    return {
      ...group,
      items: index === lastMatching ? [...items, addTask] : items,
    };
  });
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
