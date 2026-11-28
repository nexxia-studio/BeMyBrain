// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";

import { getShoppingList, type ShoppingList } from "./queries";

/**
 * Liste Courses du workspace de la session, lue avec son jeton (RLS active) et filtrée sur `workspaceId`
 * (double verrou, ADR-002). Point d'entrée de la page (src/app n'accède pas à la base).
 */
export function loadShoppingList(
  token: string,
  workspaceId: string,
): Promise<ShoppingList> {
  return withUserDb(token, (tx) => getShoppingList(workspaceId, tx));
}
