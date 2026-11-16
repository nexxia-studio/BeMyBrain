// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";

import { invokeAction, prepareAction, registry } from "./registry";

export type ActionOutcome = { name: string; result: unknown };

/**
 * Point d'entrée serveur du registre (ADR-009), appelé par la Server Action de la palette après
 * requireSessionWithToken, donc canal "web". Nom, canal et paramètres sont résolus et validés AVANT toute transaction ; l'action
 * s'exécute ensuite dans withUserDb (jeton vérifié, RLS active), avec le `workspaceId` de la session et le
 * `userId` du jeton vérifié, jamais des valeurs reçues du client.
 */
export async function runActionWithToken(
  token: string,
  workspaceId: string,
  name: unknown,
  params: unknown,
): Promise<ActionOutcome> {
  const prepared = prepareAction(registry, name, params, "web");
  const result = await withUserDb(token, (tx, { userId }) =>
    invokeAction(prepared, { workspaceId, userId, tx }),
  );
  return { name: prepared.name, result };
}
