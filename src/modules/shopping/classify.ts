/**
 * Unique point d'entrée du classement d'un article dans un rayon (spec « Classement »).
 * Ordre : correction mémorisée de l'utilisateur > dictionnaire (expression la plus longue d'abord) > Divers.
 * Fonction pure : les corrections sont lues par l'appelant, jamais ici. Le futur classement par IA se branche ici.
 */
import type { AisleKey } from "./aisles";
import { DICTIONARY_LOOKUP } from "./aisles/dictionary";
import { normalizeLabel, singularForms } from "./normalize";

export type AisleSource = "override" | "dictionary" | "fallback";
export type AisleClassification = { aisle: AisleKey; source: AisleSource };

/** Corrections mémorisées : libellé normalisé complet → rayon. */
export type AisleOverrides = ReadonlyMap<string, AisleKey>;

function lookupDictionary(words: string[]): AisleKey | undefined {
  for (let size = words.length; size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      for (const form of singularForms(words.slice(start, start + size).join(" "))) {
        const hit = DICTIONARY_LOOKUP.get(form);
        if (hit) return hit;
      }
    }
  }
  return undefined;
}

export function classifyAisle(label: string, { overrides }: { overrides: AisleOverrides }): AisleClassification {
  const { normalized, words } = normalizeLabel(label);
  const remembered = overrides.get(normalized);
  if (remembered) return { aisle: remembered, source: "override" };
  const hit = lookupDictionary(words);
  if (hit) return { aisle: hit, source: "dictionary" };
  return { aisle: "other", source: "fallback" };
}
