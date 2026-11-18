import { describe, expect, it } from "vitest";

import enMain from "../../messages/en.json";
import enErrors from "../../messages/errors/en.json";
import frErrors from "../../messages/errors/fr.json";
import frMain from "../../messages/fr.json";

// Messages complets, tels que src/i18n/request.ts les fournit (section errors dans son propre fichier).
const fr = { ...frMain, errors: frErrors };
const en = { ...enMain, errors: enErrors };

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
