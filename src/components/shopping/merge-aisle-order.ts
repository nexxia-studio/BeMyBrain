import { AISLE_KEYS, type AisleKey } from "@/modules/shopping/aisles";

/**
 * Complète l'ordre des rayons affichés (les non vides) par les rayons masqués : l'ordre enregistré doit toujours
 * citer les 12 clés (schéma de `shopping.setAisleOrder`). Chaque rayon masqué est posé juste après le rayon
 * visible qui le précède dans l'ordre par défaut (en tête s'il n'en a aucun), pour qu'il retrouve une place
 * naturelle quand un article y arrive.
 * raccourci: la place exacte d'un rayon masqué dans l'ordre déjà enregistré n'est pas connue du client (la
 * lecture ne rend que les rayons non vides) — elle est recalculée ici ; exposer l'ordre complet dans la lecture
 * si l'écart gêne.
 */
export function mergeAisleOrder(visible: readonly AisleKey[]): AisleKey[] {
  const hidden = AISLE_KEYS.filter((key) => !visible.includes(key));
  const merged: AisleKey[] = [];
  const insertAfter = (anchor: AisleKey | null, key: AisleKey) => {
    let at = anchor === null ? 0 : merged.indexOf(anchor) + 1;
    // Après les masqués déjà posés derrière cette ancre, pour garder leur ordre par défaut.
    while (at < merged.length && hidden.includes(merged[at])) at += 1;
    merged.splice(at, 0, key);
  };
  merged.push(...visible);
  for (const key of hidden) {
    const rank = AISLE_KEYS.indexOf(key);
    const anchor =
      [...visible]
        .filter((v) => AISLE_KEYS.indexOf(v) < rank)
        .sort((a, b) => AISLE_KEYS.indexOf(b) - AISLE_KEYS.indexOf(a))[0] ??
      null;
    insertAfter(anchor, key);
  }
  return merged;
}
