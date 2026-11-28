import type { AisleKey } from "./aisles";

/**
 * Nouvel ordre complet (12 clés) après un déplacement parmi les rayons visibles : les rayons visibles
 * reprennent, dans l'ordre demandé, les places qu'ils occupaient ; les rayons masqués gardent la leur.
 */
export function applyVisibleOrder(
  full: readonly AisleKey[],
  visible: readonly AisleKey[],
): AisleKey[] {
  const queue = [...visible];
  return full.map((key) => (visible.includes(key) ? queue.shift()! : key));
}
