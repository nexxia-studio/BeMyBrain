import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { sideSchema, type Side } from "@/modules/core/schemas";
import {
  parseTileHeights,
  TILE_HEIGHTS_COOKIE,
  type TileHeights,
} from "@/modules/dashboard/tile-heights";

import { BOARD_OPTION_COOKIES } from "./board-option-cookie";
import {
  type BoardOption,
  type BoardOptionValues,
  tasksViews,
  type TasksView,
} from "./tasks-view";

// Préférences d'affichage (plan socle, décision « Choix Privé / Pro ») : cookies lus côté serveur,
// jamais une donnée métier. Toute valeur inattendue retombe sur un défaut sûr, sans erreur.

export const SIDE_COOKIE = "bmb_side";

/**
 * Filtre d'espace : un cookie par côté (BRAIN-30, le filtre existe des deux côtés), pour qu'un choix
 * côté Pro n'efface pas celui du côté Privé.
 */
export function contextsCookie(side: Side): string {
  return `bmb_contexts_${side}`;
}

/** Vue de la to-do, Liste ou Tableau (spec todo-kanban, « Vue mémorisée »). */
export const TASKS_VIEW_COOKIE = "bmb_tasks_view";

// Sous-tâches en cartes, terminées non masquées, Annulée repliée.
const DEFAULT_BOARD_OPTIONS: BoardOptionValues = {
  subtasks: true,
  hideDoneSubtasks: false,
  canceledOpen: false,
};

const DEFAULT_SIDE: Side = "private";
const DEFAULT_TASKS_VIEW: TasksView = "list";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Bien au-delà du nombre de contextes d'un workspace ; borne la taille du cookie.
const MAX_SELECTED_CONTEXTS = 20;

const contextIdsSchema = z.array(z.uuid()).min(1).max(MAX_SELECTED_CONTEXTS);

export const PREFERENCE_COOKIE_OPTIONS = {
  // Lus par le serveur seulement.
  httpOnly: true,
  // WebKit refuse un cookie Secure sur http://localhost (gotcha e2e) : Secure en production.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
} as const;

/** Côté affiché ; absent ou inconnu → Privé. */
export function parseSide(raw: string | undefined): Side {
  const result = sideSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_SIDE;
}

/** Vue de la to-do lue dans le cookie ; absente ou hors de la liste fermée → Liste. (L'écriture, `setTasksView`, fait son propre contrôle.) */
export function parseTasksView(raw: unknown): TasksView {
  return tasksViews.find((view) => view === raw) ?? DEFAULT_TASKS_VIEW;
}

/** Option du tableau ; « 1 » → vrai, « 0 » → faux, toute autre valeur (ou cookie absent) → défaut de l'option. */
export function parseBoardOption(
  option: BoardOption,
  raw: string | undefined,
): boolean {
  if (raw === "1") return true;
  if (raw === "0") return false;
  return DEFAULT_BOARD_OPTIONS[option];
}

/**
 * Contextes retenus par le filtre, dans l'ordre de `available` (contextes du côté, lus en base).
 * Les identifiants inconnus du workspace sont ignorés ; sélection vide → tous.
 */
export function parseContextSelection(
  raw: string | undefined,
  available: readonly string[],
): string[] {
  const wanted = new Set(raw?.split(",") ?? []);
  const selected = available.filter((id) => wanted.has(id));
  return selected.length > 0 ? selected : [...available];
}

/** Valeur du cookie bmb_contexts_<côté>, ou null si la sélection est mal formée. */
export function serializeContextSelection(ids: unknown): string | null {
  const result = contextIdsSchema.safeParse(ids);
  return result.success ? [...new Set(result.data)].join(",") : null;
}

export async function readSide(): Promise<Side> {
  return parseSide((await cookies()).get(SIDE_COOKIE)?.value);
}

export async function readTasksView(): Promise<TasksView> {
  return parseTasksView((await cookies()).get(TASKS_VIEW_COOKIE)?.value);
}

export async function readBoardOptions(): Promise<BoardOptionValues> {
  const store = await cookies();
  const read = (option: BoardOption) =>
    parseBoardOption(option, store.get(BOARD_OPTION_COOKIES[option])?.value);
  return {
    subtasks: read("subtasks"),
    hideDoneSubtasks: read("hideDoneSubtasks"),
    canceledOpen: read("canceledOpen"),
  };
}

/** Espaces retenus pour `side`, toujours revalidés contre `available` (espaces du workspace). */
export async function readContextSelection(
  side: Side,
  available: readonly string[],
): Promise<string[]> {
  return parseContextSelection(
    (await cookies()).get(contextsCookie(side))?.value,
    available,
  );
}

/**
 * Hauteurs de tuiles relevées au dernier affichage du tableau de bord (QA-6 d'effets-de-verre) : cookie écrit par
 * le navigateur, donnée non fiable, validée par `parseTileHeights` (entrées inconnues ou hors bornes ignorées).
 * Seule la route dont le chemin correspond reçoit le cookie (`Path`).
 */
export async function readTileHeights(): Promise<TileHeights> {
  return parseTileHeights((await cookies()).get(TILE_HEIGHTS_COOKIE)?.value);
}
