// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { InvalidTokenError, withUserDb } from "@/db/client";

import { getMembership, type Membership } from "./queries";

/** Appartenance de l'utilisateur du jeton : `userId` = `sub` vérifié par withUserDb, jamais un paramètre. */
export type ResolvedMembership = Membership & { userId: string };

/**
 * Vérifie le jeton Neon Auth et lit, en une transaction, le workspace et la langue de son utilisateur.
 * Point d'entrée de requireSession (src/lib n'accède pas à la base, ADR-002).
 */
export function resolveMembership(token: string): Promise<ResolvedMembership> {
  return withUserDb(token, async (tx, { userId }) => ({
    userId,
    ...(await getMembership(userId, tx)),
  }));
}

/**
 * Jeton refusé par withUserDb (signature, expiration, iss, aud, sub) : la session n'est plus valable,
 * requireSession renvoie vers /login. Prédicat plutôt que ré-export de la classe : src/lib n'importe rien
 * de src/db (ADR-002).
 */
export function isRejectedToken(error: unknown): boolean {
  return error instanceof InvalidTokenError;
}

/**
 * Code jose d'un jeton refusé (`ERR_…`, déjà filtré par withUserDb), « unknown » s'il n'en a pas, null pour
 * toute autre erreur. Seule donnée journalisable d'un refus : ni jeton, ni claims, ni identifiant.
 */
export function rejectedTokenCode(error: unknown): string | null {
  if (!(error instanceof InvalidTokenError)) return null;
  return error.code ?? "unknown";
}
