import { errorTag } from "./error-tag";

// Issue d'une écriture en base sous forme d'étiquette, pour les tests de droits et de RLS : l'erreur
// brute du pilote (elle porte hôte et mot de passe) ne sort jamais vers `expect`.

export const OK = "ok";
/** 42501 par droit absent (GRANT). */
export const GRANT_REFUSAL = "42501:droit";
/** 42501 par policy (RLS). */
export const RLS_REFUSAL = "42501:rls";
export const FOREIGN_KEY_VIOLATION = "23503";
export const UNIQUE_VIOLATION = "23505";
export const CHECK_VIOLATION = "23514";

/**
 * Étiquette d'un refus : le SQLSTATE. 42501 couvre deux couches : « 42501:droit » (GRANT absent) ou
 * « 42501:rls » (policy).
 */
export function refusalTag(error: unknown): string {
  const tag = errorTag(error);
  if (tag !== "42501") return tag;
  const message = String((error as { message?: unknown }).message);
  return /permission denied/.test(message) ? `${tag}:droit` : `${tag}:rls`;
}

/** Ne laisse jamais sortir l'erreur brute : un test qui échoue n'affiche que l'étiquette. */
export async function tagged<T>(query: Promise<T>): Promise<T> {
  try {
    return await query;
  } catch (error) {
    throw new Error(refusalTag(error));
  }
}

/** Issue d'une écriture passée par `tagged` : « ok », ou l'étiquette du refus. */
export async function outcome(write: Promise<unknown>): Promise<string> {
  try {
    await write;
    return OK;
  } catch (error) {
    return (error as Error).message;
  }
}
