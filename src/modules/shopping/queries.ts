import { and, asc, eq } from "drizzle-orm";

import type { UserTx } from "@/db/client";
import {
  shoppingAisleOrder,
  shoppingAisleOverrides,
  shoppingItems,
  shoppingLists,
} from "@/db/schema/shopping";
import { uuidSchema } from "@/modules/core/schemas";

import type { AisleKey } from "./aisles";
import { ShoppingError } from "./errors";
import {
  groupByAisle,
  resolveAisleOrder,
  type AisleGroup,
  type ShoppingItem,
} from "./list-view";

// Lectures du module shopping (ADR-004). Même contrat que tasks : workspaceId en premier, transaction de
// withUserDb (RLS active) en dernier, filtre explicite sur workspaceId en plus de la RLS (ADR-002).
// Corrections et ordre des rayons sont propres à l'utilisateur : la RLS (user_id = utilisateur connecté)
// est leur filtre, user_id n'étant ni un paramètre ni un droit de l'app.

export const DEFAULT_LIST_NAME = "Courses";

export type ShoppingList = {
  /** null tant que la liste n'a jamais été créée (une lecture n'écrit rien). */
  id: string | null;
  name: string;
  rev: number;
  /** Rayons non vides, dans l'ordre de l'utilisateur ; cochés en bas de leur rayon. */
  aisles: AisleGroup[];
};

function parseWorkspace(workspaceId: unknown): string {
  const result = uuidSchema.safeParse(workspaceId);
  if (!result.success) throw new ShoppingError("invalid_params");
  return result.data;
}

/** Corrections de rayon mémorisées par l'utilisateur : libellé normalisé complet → rayon. */
export async function getAisleOverrides(
  workspaceId: string,
  tx: UserTx,
): Promise<Map<string, AisleKey>> {
  const workspace = parseWorkspace(workspaceId);
  const rows = await tx
    .select({
      keyword: shoppingAisleOverrides.keyword,
      aisleKey: shoppingAisleOverrides.aisleKey,
    })
    .from(shoppingAisleOverrides)
    .where(eq(shoppingAisleOverrides.workspaceId, workspace));
  return new Map(rows.map((r) => [r.keyword, r.aisleKey as AisleKey]));
}

/** Ordre des rayons de l'utilisateur (mémorisé, complété par l'ordre par défaut). */
export async function getAisleOrder(
  workspaceId: string,
  tx: UserTx,
): Promise<AisleKey[]> {
  const workspace = parseWorkspace(workspaceId);
  const [row] = await tx
    .select({ keys: shoppingAisleOrder.aisleKeys })
    .from(shoppingAisleOrder)
    .where(eq(shoppingAisleOrder.workspaceId, workspace));
  return resolveAisleOrder(row?.keys);
}

export async function getShoppingList(
  workspaceId: string,
  tx: UserTx,
): Promise<ShoppingList> {
  const workspace = parseWorkspace(workspaceId);
  const [list] = await tx
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      rev: shoppingLists.rev,
    })
    .from(shoppingLists)
    .where(eq(shoppingLists.workspaceId, workspace));
  const order = await getAisleOrder(workspace, tx);
  if (!list) {
    return { id: null, name: DEFAULT_LIST_NAME, rev: 0, aisles: [] };
  }

  const rows = await tx
    .select({
      id: shoppingItems.id,
      label: shoppingItems.label,
      aisleKey: shoppingItems.aisleKey,
      checkedAt: shoppingItems.checkedAt,
      addedByGuest: shoppingItems.addedByGuest,
    })
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.workspaceId, workspace),
        eq(shoppingItems.listId, list.id),
      ),
    )
    .orderBy(asc(shoppingItems.createdAt), asc(shoppingItems.id));
  const items: ShoppingItem[] = rows.map((r) => ({
    ...r,
    aisleKey: r.aisleKey as AisleKey,
  }));

  return { ...list, aisles: groupByAisle(items, order) };
}
