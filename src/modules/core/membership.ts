import { withUserDb } from "@/db/client";

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
