// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";

import { type Context, listContexts, type Side } from "./queries";

/**
 * Contextes d'un côté (Privé / Pro) du workspace de la session, lus avec son jeton (RLS active) et
 * filtrés sur `workspaceId` (double verrou, ADR-002). Point d'entrée de la coque (src/app n'accède pas à la base).
 */
export function loadContexts(
  token: string,
  workspaceId: string,
  side: Side,
): Promise<Context[]> {
  return withUserDb(token, (tx) => listContexts(workspaceId, { side }, tx));
}

/**
 * Contextes des deux côtés du workspace de la session, en une transaction (coque : l'ajout rapide et la palette
 * suivent une bascule Privé / Pro sans attendre de lecture). Même verrou que `loadContexts`.
 */
export function loadContextsBySide(
  token: string,
  workspaceId: string,
): Promise<Record<Side, Context[]>> {
  return withUserDb(token, async (tx) => ({
    // Une requête à la fois sur la transaction.
    private: await listContexts(workspaceId, { side: "private" }, tx),
    pro: await listContexts(workspaceId, { side: "pro" }, tx),
  }));
}
