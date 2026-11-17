import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

function flatten(messages: object, prefix = ""): Record<string, unknown> {
  return Object.entries(messages).reduce<Record<string, unknown>>(
    (acc, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === "object") {
        return { ...acc, ...flatten(value, path) };
      }
      return { ...acc, [path]: value };
    },
    {},
  );
}

describe("messages", () => {
  it("fr.json et en.json ont exactement les mêmes clés", () => {
    const frKeys = Object.keys(flatten(fr)).sort();

    const enKeys = Object.keys(flatten(en)).sort();

    expect(enKeys).toEqual(frKeys);
  });

  it("aucune valeur vide", () => {
    const all = { ...flatten(fr, "fr"), ...flatten(en, "en") };

    const empty = Object.entries(all)
      .filter(([, value]) => typeof value !== "string" || value.trim() === "")
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });
});
