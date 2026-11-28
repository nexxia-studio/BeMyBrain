import { AISLE_KEYS, DEFAULT_AISLE_ORDER, type AisleKey } from "./aisles";

// Mise en forme pure de la liste (aucun accès base) : testable sans base, partagée par queries.ts.

export type ShoppingItem = {
  id: string;
  label: string;
  aisleKey: AisleKey;
  checkedAt: Date | null;
  addedByGuest: boolean;
};

export type AisleGroup = { aisleKey: AisleKey; items: ShoppingItem[] };

const isAisleKey = (key: string): key is AisleKey =>
  (AISLE_KEYS as readonly string[]).includes(key);

/** Ordre mémorisé en tête (clés inconnues ou répétées ignorées), puis les rayons manquants par défaut. */
export function resolveAisleOrder(
  saved: readonly string[] | null | undefined,
): AisleKey[] {
  const order: AisleKey[] = [];
  for (const key of saved ?? []) {
    if (isAisleKey(key) && !order.includes(key)) order.push(key);
  }
  for (const key of DEFAULT_AISLE_ORDER) {
    if (!order.includes(key)) order.push(key);
  }
  return order;
}

/**
 * Regroupe par rayon, dans l'ordre donné ; un rayon sans article n'apparaît pas. `items` arrive dans l'ordre
 * d'ajout : non cochés d'abord (ordre d'ajout), cochés ensuite par date de cochage croissante.
 */
export function groupByAisle(
  items: readonly ShoppingItem[],
  order: readonly AisleKey[],
): AisleGroup[] {
  const groups: AisleGroup[] = [];
  for (const aisleKey of order) {
    const inAisle = items.filter((i) => i.aisleKey === aisleKey);
    if (inAisle.length === 0) continue;
    const open = inAisle.filter((i) => i.checkedAt === null);
    const done = inAisle
      .filter((i) => i.checkedAt !== null)
      .sort((a, b) => a.checkedAt!.getTime() - b.checkedAt!.getTime());
    groups.push({ aisleKey, items: [...open, ...done] });
  }
  return groups;
}
