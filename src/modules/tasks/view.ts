// Règles d'affichage de la to-do (spec todo-unifiee, « Liste » et « Tableau de bord ») : fonctions pures,
// sans horloge (`today` = `todayIn(getUserTimeZone(), now)`, `YYYY-MM-DD`), sans React, Next ni zod :
// importables côté client. Les dates sont des chaînes `YYYY-MM-DD` calculées en UTC, sans fuseau de la machine.

import type { Side } from "@/modules/core/sides";

import type { Task } from "./queries";
import { openStatusCategories } from "./sides";

export const sectionKeys = [
  "overdue",
  "today",
  "tomorrow",
  "later",
  "none",
  "completed",
] as const;
export type SectionKey = (typeof sectionKeys)[number];

export type TaskSection = { key: SectionKey; tasks: Task[] };

/** Nombre de tâches de la tuile « Aujourd'hui » (DESIGN.md § 5). */
export const TODAY_TILE_LIMIT = 3;
/** Nombre de tâches des tuiles « To-do privée » et « To-do pro ». */
export const SIDE_TILE_LIMIT = 5;

const DAY_MS = 86_400_000;

function toUtcMs(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1);
}

function addDays(day: string, days: number): string {
  return new Date(toUtcMs(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 dimanche … 6 samedi. */
function weekday(day: string): number {
  return new Date(toUtcMs(day)).getUTCDay();
}

function isOpen(task: Task): boolean {
  return (openStatusCategories as readonly string[]).includes(
    task.statusCategory,
  );
}

/** Une sous-tâche n'a sa propre ligne que si elle a une échéance ; sinon seul le compteur de la parente la montre. */
function isListed(task: Task): boolean {
  return task.parentId === null || task.dueDate !== null;
}

// Priorité 0 (aucune) après la basse (4), comme listOrder de queries.ts.
function priorityRank(task: Task): number {
  return task.priority === 0 ? 5 : task.priority;
}

function compareCreation(a: Task, b: Task): number {
  return (
    a.createdAt.getTime() - b.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

// null en dernier ; chaînes `YYYY-MM-DD` et `HH:MM` comparables telles quelles.
function compareNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/**
 * Ordre des tâches ouvertes (sections de la liste, tuiles) : échéance (sans échéance en dernier), heure (sans heure
 * en dernier), priorité (aucune en dernier), création, id. Doit rester identique à listOrder de queries.ts
 * (verrou : test « ordre » de queries.test.ts). Dans « Sans échéance », reste priorité puis création.
 */
export function compareTasks(a: Task, b: Task): number {
  return (
    compareNullable(a.dueDate, b.dueDate) ||
    compareNullable(a.dueTime, b.dueTime) ||
    priorityRank(a) - priorityRank(b) ||
    compareCreation(a, b)
  );
}

function compareCompleted(a: Task, b: Task): number {
  const at = a.completedAt?.getTime() ?? -Infinity;
  const bt = b.completedAt?.getTime() ?? -Infinity;
  return bt - at || compareCreation(a, b);
}

function openSectionOf(task: Task, today: string): SectionKey {
  if (task.dueDate === null) return "none";
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate === addDays(today, 1)) return "tomorrow";
  return "later";
}

/**
 * Sections de la liste, dans l'ordre de `sectionKeys`, vides omises. Ouvertes triées par `compareTasks` ;
 * fermées (terminées et annulées, si la lecture les inclut) en dernière section, par fin décroissante.
 * Sous-tâche : seulement si elle a une échéance (jamais dans « Sans échéance »).
 */
export function groupBySection(tasks: Task[], today: string): TaskSection[] {
  const byKey = new Map<SectionKey, Task[]>(sectionKeys.map((k) => [k, []]));
  for (const task of tasks) {
    if (!isListed(task)) continue;
    const key = isOpen(task) ? openSectionOf(task, today) : "completed";
    byKey.get(key)?.push(task);
  }
  return sectionKeys
    .map((key) => {
      const list = byKey.get(key) ?? [];
      list.sort(key === "completed" ? compareCompleted : compareTasks);
      return { key, tasks: list };
    })
    .filter((section) => section.tasks.length > 0);
}

/** Compteur « n/m » des sous-tâches (calculé en base, annulées exclues) ; null sans sous-tâche comptée. */
export function subtaskCounter(task: Task): string | null {
  return task.subtaskTotal === 0
    ? null
    : `${task.subtaskDone}/${task.subtaskTotal}`;
}

export type TodayTile = {
  overdueCount: number;
  todayCount: number;
  /** Les premières par échéance, des deux côtés (le côté s'écrit en légende). */
  items: Task[];
};

/** Tuile « Aujourd'hui » : tâches ouvertes en retard ou dues `today`, sous-tâches comprises (entrée : `listDueToday`). */
export function todayTileItems(tasks: Task[], today: string): TodayTile {
  const due = tasks.filter(
    (t) => isOpen(t) && t.dueDate !== null && t.dueDate <= today,
  );
  return {
    overdueCount: due.filter((t) => t.dueDate !== today).length,
    todayCount: due.filter((t) => t.dueDate === today).length,
    items: [...due].sort(compareTasks).slice(0, TODAY_TILE_LIMIT),
  };
}

/**
 * Tuiles « To-do privée » / « To-do pro » : les prochaines tâches ouvertes du côté, par échéance (sans échéance
 * en dernier), mêmes règles de sous-tâches que la liste.
 */
export function sideTileItems(tasks: Task[], side: Side): Task[] {
  return tasks
    .filter((t) => t.side === side && isOpen(t) && isListed(t))
    .sort(compareTasks)
    .slice(0, SIDE_TILE_LIMIT);
}

export type DateShortcuts = {
  today: string;
  tomorrow: string;
  /** `today` le samedi et le dimanche ; du lundi au vendredi, le samedi qui suit. */
  weekend: string;
  /** Lundi suivant (lundi d'après si on est lundi). */
  nextWeek: string;
};

/** Raccourcis de date de l'ajout rapide, en `YYYY-MM-DD`. */
export function dateShortcuts(today: string): DateShortcuts {
  const day = weekday(today);
  return {
    today,
    tomorrow: addDays(today, 1),
    weekend: day === 0 ? today : addDays(today, 6 - day),
    nextWeek: addDays(today, (1 - day + 7) % 7 || 7),
  };
}

// Tags de l'ajout rapide : un nom se compare sans casse (unique `(workspace_id, lower(name))` en base) et sans
// les espaces autour (le schéma les retire).
const tagKey = (name: string) => name.trim().toLowerCase();

/** Tags dont le nom contient `query` (sans casse), dans l'ordre reçu ; recherche vide → tous. */
export function matchTagNames(names: readonly string[], query: string): string[] {
  const wanted = tagKey(query);
  return names.filter((name) => tagKey(name).includes(wanted));
}

/** Nom enregistré du tag désigné par `name` (sans casse), ou undefined s'il n'existe pas. */
export function findTagName(
  names: readonly string[],
  name: string,
): string | undefined {
  const wanted = tagKey(name);
  return names.find((existing) => tagKey(existing) === wanted);
}
