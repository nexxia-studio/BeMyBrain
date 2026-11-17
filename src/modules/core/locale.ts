// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";
import type { AppLocale } from "@/i18n/locales";

import { setMemberLocale } from "./mutations";

/**
 * Enregistre la langue du membre dans le workspace de la session (ADR-007) et renvoie la langue appliquée.
 * Le membre est le `sub` du jeton vérifié par withUserDb, jamais un paramètre. Point d'entrée de l'action
 * des réglages (src/app n'accède pas à la base).
 */
export function saveMemberLocale(
  token: string,
  workspaceId: string,
  locale: AppLocale,
): Promise<AppLocale> {
  return withUserDb(token, (tx, { userId }) =>
    setMemberLocale(workspaceId, userId, locale, tx),
  );
}
