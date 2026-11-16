import { describe, expect, it } from "vitest";

import fr from "../../messages/fr.json";

// Registre décidé par Antoine le 2026-11-16 (PRODUCT.md, « Ton des textes ») :
// tutoiement partout, jamais de vouvoiement.

function strings(messages: object, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      return strings(value as object, path);
    }
    return typeof value === "string" ? [[path, value] as [string, string]] : [];
  });
}

// Mots entiers, lettres accentuées comprises : `\b` et `\w` de JavaScript
// ignorent « é », ce qui couperait « Réessayez » en « essayez ».
const VOUS = /(?<!\p{L})(vous|votre|vos)(?!\p{L})/iu;
const IMPERATIVE_EZ = /(?<!\p{L})\p{L}+ez(?!\p{L})/giu;

// Faux positifs réels : mots français en « -ez » qui ne sont pas des verbes.
const NOT_A_VERB = new Set(["chez", "assez", "nez"]);

function formalAddress(text: string): string | null {
  const vous = VOUS.exec(text);
  if (vous) return vous[0];
  const verb = [...text.matchAll(IMPERATIVE_EZ)]
    .map((match) => match[0])
    .find((word) => !NOT_A_VERB.has(word.toLowerCase()));
  return verb ?? null;
}

describe("registre de messages/fr.json", () => {
  it("aucun texte ne vouvoie la personne", () => {
    const entries = strings(fr);

    const offenders = entries
      .map(([key, text]) => ({ key, text, word: formalAddress(text) }))
      .filter((entry) => entry.word !== null)
      .map((entry) => `${entry.key} : « ${entry.text} » (${entry.word})`);

    expect(offenders).toEqual([]);
  });

  it("détecte le vouvoiement et les impératifs en -ez, pas les faux positifs", () => {
    const samples = [
      "Vérifiez ton e-mail.",
      "Vos réglages",
      "Réessayez.",
      "Chez toi, assez vite, le nez au vent.",
    ];

    const results = samples.map(formalAddress);

    expect(results).toEqual(["Vérifiez", "Vos", "Réessayez", null]);
  });
});
