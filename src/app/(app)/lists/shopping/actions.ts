"use server";

import { requireSessionWithToken } from "@/lib/session";
import type { AisleKey } from "@/modules/shopping/aisles";
import {
  SHOPPING_ERROR_MESSAGES,
  type ShoppingErrorCode,
} from "@/modules/shopping/errors";

import { runWebAction } from "../../web-action";

/**
 * Issue renvoyée à l'écran Courses. `code` : seulement un code de `ShoppingError` (traduit par l'écran) ;
 * tout autre refus ou panne → `{ ok: false }` sans code, message générique côté écran.
 */
export type ShoppingActionResult =
  { ok: true; result: unknown } | { ok: false; code?: ShoppingErrorCode };

function isShoppingErrorCode(code: string): code is ShoppingErrorCode {
  return Object.hasOwn(SHOPPING_ERROR_MESSAGES, code);
}

/**
 * Une Server Action par écriture d'écran, toutes via le registre (ADR-009, `shopping.*`). Chaque action appelle
 * elle-même `requireSessionWithToken()` en première instruction (renvoi vers /login sans session) ; le nom de l'action est fixé ici, l'origine est toujours `app`, le
 * workspace vient de la session, jamais des arguments. Les arguments sont validés par le schéma du
 * registre (`z.strictObject`) : un refus devient `{ ok: false, code: "invalid_params" }`, pas une exception.
 * Côté client : appeler par `settleAction` (`src/lib/settle-action.ts`).
 */
async function run(
  workspaceId: string,
  token: string,
  name: string,
  params: unknown,
): Promise<ShoppingActionResult> {
  const outcome = await runWebAction(token, workspaceId, "app", name, params);
  if (outcome.ok) return outcome;
  return outcome.code !== undefined && isShoppingErrorCode(outcome.code)
    ? { ok: false, code: outcome.code }
    : { ok: false };
}

export async function addShoppingItem(
  label: string,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.addItem", { label });
}

export async function checkShoppingItem(
  itemId: string,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.checkItem", { itemId });
}

export async function uncheckShoppingItem(
  itemId: string,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.uncheckItem", { itemId });
}

export async function renameShoppingItem(
  itemId: string,
  label: string,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.renameItem", {
    itemId,
    label,
  });
}

export async function removeShoppingItem(
  itemId: string,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.removeItem", { itemId });
}

export async function clearCheckedShoppingItems(): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.clearChecked", {});
}

export async function moveShoppingItemToAisle(
  itemId: string,
  aisleKey: AisleKey,
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.moveItemToAisle", {
    itemId,
    aisleKey,
  });
}

export async function setShoppingAisleOrder(
  order: AisleKey[],
): Promise<ShoppingActionResult> {
  const { session, token } = await requireSessionWithToken();
  return run(session.workspaceId, token, "shopping.setAisleOrder", { order });
}
