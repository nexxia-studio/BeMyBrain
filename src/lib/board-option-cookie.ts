// Cookies des options du tableau, partagés par le serveur (lecture dans `preferences.ts`, écriture dans
// `preferences-actions.ts`) et par les contrôles clients, qui posent le même cookie au clic. Sans `server-only`
// ni zod : importable dans le bundle client.
import type { BoardOption } from "./tasks-view";

export const BOARD_OPTION_COOKIES: Record<BoardOption, string> = {
  subtasks: "bmb_board_subtasks",
  hideDoneSubtasks: "bmb_board_hide_done_subtasks",
  canceledOpen: "bmb_board_canceled_open",
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Pas httpOnly : le navigateur refuse qu'un script écrase un cookie httpOnly, et ce sont des préférences
// d'affichage sans secret. Le serveur reste la seule lecture ; le cookie client ne fait que le précéder.
export const BOARD_OPTION_COOKIE_OPTIONS = {
  httpOnly: false,
  // WebKit refuse un cookie Secure sur http://localhost (gotcha e2e) : Secure en production.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: ONE_YEAR_SECONDS,
} as const;

export function serializeBoardOption(value: boolean): string {
  return value ? "1" : "0";
}

/**
 * Pose le cookie de l'option dans le navigateur, de façon synchrone au clic : un rechargement lancé avant la
 * fin de l'action serveur relit déjà le bon état. L'action serveur écrit ensuite la même valeur.
 */
export function writeBoardOptionCookie(
  option: BoardOption,
  value: boolean,
): void {
  const { secure, sameSite, path, maxAge } = BOARD_OPTION_COOKIE_OPTIONS;
  document.cookie = [
    `${BOARD_OPTION_COOKIES[option]}=${serializeBoardOption(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
