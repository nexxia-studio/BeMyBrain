import { describe, expect, it } from "vitest";

import { AISLE_KEYS, type AisleKey } from "../aisles";
import { normalizeLabel, singularForms } from "../normalize";
import { DICTIONARY, DICTIONARY_LOOKUP } from "./dictionary";
import { REFERENCE_SET } from "./reference-set";

const entries = AISLE_KEYS.flatMap((aisle) => DICTIONARY[aisle].map((term) => ({ aisle, term })));

// Contrôle de couverture seulement : la vraie recherche est `classifyAisle` (tâche 4).
function lookup(label: string): AisleKey | undefined {
  const { words, forms } = normalizeLabel(label);
  for (const form of forms) {
    const hit = DICTIONARY_LOOKUP.get(form);
    if (hit) return hit;
  }
  for (let size = words.length - 1; size >= 1; size--) {
    for (let start = 0; start + size <= words.length; start++) {
      for (const form of singularForms(words.slice(start, start + size).join(" "))) {
        const hit = DICTIONARY_LOOKUP.get(form);
        if (hit) return hit;
      }
    }
  }
  return undefined;
}

describe("dictionnaire des rayons", () => {
  it("couvre tous les rayons de la liste fixe, sans rayon inconnu", () => {
    expect(Object.keys(DICTIONARY).sort()).toEqual([...AISLE_KEYS].sort());
  });

  it("toutes les entrées sont déjà normalisées", () => {
    for (const { term } of entries) {
      expect(normalizeLabel(term).normalized, term).toBe(term);
      expect(term.length, term).toBeGreaterThan(0);
    }
  });

  it("aucune clé n'est en double, ni dans un rayon ni entre deux rayons", () => {
    const seen = new Map<string, AisleKey>();
    const doubles: string[] = [];
    for (const { aisle, term } of entries) {
      const before = seen.get(term);
      if (before) doubles.push(`${term}: ${before} / ${aisle}`);
      seen.set(term, aisle);
    }
    expect(doubles).toEqual([]);
  });

  it("la table de recherche donne le rayon déclaré de chaque entrée", () => {
    expect(DICTIONARY_LOOKUP.size).toBe(entries.length);
    for (const { aisle, term } of entries) expect(DICTIONARY_LOOKUP.get(term), term).toBe(aisle);
  });

  it("range les cas d'acceptation de la spec", () => {
    expect(lookup("pomme")).toBe("produce");
    expect(lookup("déo")).toBe("hygiene");
    expect(lookup("déodorant")).toBe("hygiene");
    for (const y of ["yaourt", "yogourt", "yoghourt"]) expect(lookup(y)).toBe("dairyEggs");
    expect(lookup("PQ")).toBe("household");
    expect(lookup("sopalin")).toBe("household");
    expect(lookup("bidule")).toBeUndefined();
  });
});

describe("jeu de référence", () => {
  it("compte au moins 150 articles, dont au moins 60 en français et 60 en anglais", () => {
    expect(REFERENCE_SET.length).toBeGreaterThanOrEqual(150);
    expect(REFERENCE_SET.filter((r) => r.lang === "fr").length).toBeGreaterThanOrEqual(60);
    expect(REFERENCE_SET.filter((r) => r.lang === "en").length).toBeGreaterThanOrEqual(60);
  });

  it("chaque entrée vise un rayon valide, sans libellé en double", () => {
    for (const r of REFERENCE_SET) expect(AISLE_KEYS, r.label).toContain(r.expected);
    const labels = REFERENCE_SET.map((r) => normalizeLabel(r.label).normalized);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("couvre chaque rayon sauf Divers", () => {
    for (const aisle of AISLE_KEYS.filter((k) => k !== "other")) {
      expect(REFERENCE_SET.filter((r) => r.expected === aisle).length, aisle).toBeGreaterThanOrEqual(5);
    }
  });

  it("le dictionnaire classe au moins 95 % du jeu comme attendu", () => {
    const wrong = REFERENCE_SET.filter((r) => (lookup(r.label) ?? "other") !== r.expected).map((r) => r.label);
    expect(wrong.length / REFERENCE_SET.length, wrong.join(", ")).toBeLessThanOrEqual(0.05);
  });
});
