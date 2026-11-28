import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import { AISLE_KEYS, DEFAULT_AISLE_ORDER } from "./aisles";

describe("rayons des courses", () => {
  it("l'ordre par défaut contient chaque clé une fois, « other » en dernier", () => {
    expect([...DEFAULT_AISLE_ORDER].sort()).toEqual([...AISLE_KEYS].sort());
    expect(new Set(DEFAULT_AISLE_ORDER).size).toBe(DEFAULT_AISLE_ORDER.length);
    expect(DEFAULT_AISLE_ORDER.at(-1)).toBe("other");
  });

  it("suit l'ordre de la spec (Q1) : 11 rayons puis « Divers »", () => {
    expect(DEFAULT_AISLE_ORDER).toEqual([
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
    ]);
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ])("chaque clé a un libellé %s non vide", (_lang, messages) => {
    const labels = messages.shopping.aisles as Record<string, string>;
    for (const key of AISLE_KEYS) {
      expect(labels[key]?.trim().length).toBeGreaterThan(0);
    }
    expect(Object.keys(labels).sort()).toEqual([...AISLE_KEYS].sort());
  });
});
