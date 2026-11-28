/**
 * Rayons des courses : clés stables en code, libellés dans `messages/{fr,en}.json` (`shopping.aisles.<clé>`).
 * L'ordre du tuple est l'ordre par défaut (spec Q1) ; « other » (Divers) est le dernier et se réordonne
 * comme les autres. Fichier sans dépendance : importable côté client.
 */
export const AISLE_KEYS = [
  "produce",
  "bakery",
  "butcherFish",
  "dairyEggs",
  "pantrySavory",
  "pantrySweet",
  "drinks",
  "household",
  "hygiene",
  "babyPets",
  "frozen",
  "other",
] as const;

export type AisleKey = (typeof AISLE_KEYS)[number];

/** Ordre affiché tant que l'utilisateur n'a pas glissé les rayons. */
export const DEFAULT_AISLE_ORDER: readonly AisleKey[] = AISLE_KEYS;
