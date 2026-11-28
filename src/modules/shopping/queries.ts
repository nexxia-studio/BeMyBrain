import { and, asc, count, eq, isNull } from "drizzle-orm";

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
  /** Ordre complet des 12 rayons de l'utilisateur, masqués compris. */
  order: AisleKey[];
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
    return { id: null, name: DEFAULT_LIST_NAME, rev: 0, order, aisles: [] };
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

  return { ...list, order, aisles: groupByAisle(items, order) };
}

/** Nombre d'articles montrés par la tuile du tableau de bord. */
export const SUMMARY_ITEM_LIMIT = 3;

export type ShoppingSummary = {
  /** Articles à acheter (non cochés), tous rayons confondus. */
  count: number;
  /** Libellés des premiers articles à acheter, par ordre d'ajout (au plus SUMMARY_ITEM_LIMIT). */
  first: string[];
};

/** Résumé de la liste pour la tuile du tableau de bord : lecture seule, une liste jamais créée donne 0. */
export async function getShoppingSummary(
  workspaceId: string,
  tx: UserTx,
): Promise<ShoppingSummary> {
  const workspace = parseWorkspace(workspaceId);
  const open = and(
    eq(shoppingItems.workspaceId, workspace),
    isNull(shoppingItems.checkedAt),
  );
  const [total] = await tx
    .select({ value: count() })
    .from(shoppingItems)
    .where(open);
  const rows = await tx
    .select({ label: shoppingItems.label })
    .from(shoppingItems)
    .where(open)
    .orderBy(asc(shoppingItems.createdAt), asc(shoppingItems.id))
    .limit(SUMMARY_ITEM_LIMIT);
  return { count: total?.value ?? 0, first: rows.map((r) => r.label) };
}
