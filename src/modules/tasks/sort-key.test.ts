import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  keyBetween,
  keysFor,
  KEYS_FOR_MAX,
  SORT_KEY_MAX_LENGTH,
} from "./sort-key";

/** Forme d'une clé valide : alphabet `0-9A-Za-z`, jamais vide, jamais terminée par « 0 ». */
const VALID_KEY = /^[0-9A-Za-z]*[1-9A-Za-z]$/;

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : le test rejoue toujours la même suite. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordre de la colonne `COLLATE "C"` : unités de code (`<`), jamais `localeCompare`. */
function isStrictlyIncreasing(keys: string[]): boolean {
  return keys.every((key, index) => index === 0 || keys[index - 1]! < key);
}

function longest(keys: string[]): number {
  return Math.max(...keys.map((key) => key.length));
}

describe("keyBetween", () => {
  it("donne une première clé valide à une colonne vide", () => {
    const key = keyBetween(null, null);

    expect(key).toMatch(VALID_KEY);
  });

  it.each([
    ["V", "W"],
    ["V", "V1"],
    ["Uz", "V"],
    ["0z", "1"],
    ["1", "z"],
    ["A", "a"],
    ["Z", "a"],
    ["9", "A"],
    ["zy", "zz"],
    ["01", "02"],
    ["V", "V0001"],
    ["Vzzz", "W"],
  ])("rend une clé strictement entre %s et %s", (before, after) => {
    const key = keyBetween(before, after);

    expect(key).toMatch(VALID_KEY);
    expect(before < key).toBe(true);
    expect(key < after).toBe(true);
  });

  it.each([
    "1",
    "01",
    "001",
    "0001",
    "00001",
    "V",
    "0J7",
    "1z",
    "z",
    "zz",
    "zzz",
    "zy",
    "zzy",
    "y",
    "yz",
    "0z",
    "z1",
    "z0001",
    "10001",
  ])("trouve une clé avant et une clé après %s", (key) => {
    const before = keyBetween(null, key);
    const after = keyBetween(key, null);

    expect(before).toMatch(VALID_KEY);
    expect(after).toMatch(VALID_KEY);
    expect(before < key).toBe(true);
    expect(key < after).toBe(true);
  });

  it("garde un ordre total sans doublon après 1 000 insertions à des positions aléatoires", () => {
    const random = seededRandom(20261125);
    const keys: string[] = [];

    for (let i = 0; i < 1000; i++) {
      const position = Math.floor(random() * (keys.length + 1));
      const key = keyBetween(
        keys[position - 1] ?? null,
        keys[position] ?? null,
      );
      keys.splice(position, 0, key);
    }

    expect(keys).toHaveLength(1000);
    expect(new Set(keys).size).toBe(1000);
    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(6);
  });

  it("reste ordonnée et courte (3 caractères au plus) après 200 insertions en tête", () => {
    const keys = [keyBetween(null, null)];

    for (let i = 0; i < 200; i++) {
      keys.unshift(keyBetween(null, keys[0]!));
    }

    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(3);
  });

  it("reste ordonnée et courte (3 caractères au plus) après 200 insertions en queue", () => {
    const keys = [keyBetween(null, null)];

    for (let i = 0; i < 200; i++) {
      keys.push(keyBetween(keys.at(-1)!, null));
    }

    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(3);
  });

  it("reste ordonnée (41 caractères au plus) après 200 insertions juste après la même voisine", () => {
    const [before, after] = keysFor(2) as [string, string];
    const keys = [before, after];

    for (let i = 0; i < 200; i++) {
      keys.splice(1, 0, keyBetween(before, keys[1]!));
    }

    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(41);
  });

  it("reste ordonnée (34 caractères au plus) après 200 insertions juste avant la même voisine", () => {
    const [before, after] = keysFor(2) as [string, string];
    const keys = [before, after];

    for (let i = 0; i < 200; i++) {
      keys.splice(-1, 0, keyBetween(keys.at(-2)!, after));
    }

    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(34);
  });

  it("refuse deux voisines égales", () => {
    expect(() => keyBetween("V", "V")).toThrow(
      "Sort key neighbours are equal or reversed.",
    );
  });

  it("refuse deux voisines inversées", () => {
    expect(() => keyBetween("W", "V")).toThrow(
      "Sort key neighbours are equal or reversed.",
    );
  });

  it.each([
    ["vide", ""],
    ["hors alphabet", "V-1"],
    ["accentuée", "é"],
    ["terminée par le plus petit caractère", "V0"],
    ["faite du seul plus petit caractère", "0"],
  ])("refuse une clé %s, avant comme après", (_label, invalid) => {
    expect(() => keyBetween(invalid, null)).toThrow("Invalid sort key.");
    expect(() => keyBetween(null, invalid)).toThrow("Invalid sort key.");
    expect(() => keyBetween(invalid, "z")).toThrow("Invalid sort key.");
    expect(() => keyBetween("1", invalid)).toThrow("Invalid sort key.");
  });

  it.each([
    ["un nombre", 12],
    ["undefined", undefined],
    ["un objet", { toString: () => "V" }],
  ])("refuse %s à la place d'une clé, avec la même phrase", (_label, value) => {
    const notAString = value as unknown as string;

    expect(() => keyBetween(notAString, null)).toThrow("Invalid sort key.");
    expect(() => keyBetween(null, notAString)).toThrow("Invalid sort key.");
  });

  it("accepte une voisine de 64 caractères et refuse une voisine de 65 caractères", () => {
    const longestAllowed = "V".repeat(SORT_KEY_MAX_LENGTH);
    const tooLong = "V".repeat(SORT_KEY_MAX_LENGTH + 1);

    expect(SORT_KEY_MAX_LENGTH).toBe(64);
    expect(keyBetween(longestAllowed, null)).toMatch(VALID_KEY);
    expect(() => keyBetween(tooLong, null)).toThrow("Invalid sort key.");
    expect(() => keyBetween(null, tooLong)).toThrow("Invalid sort key.");
  });

  it("peut rendre une clé plus longue que la borne entre deux voisines adjacentes de 64 caractères : l'appelant le voit à la longueur", () => {
    const stem = "V" + "0".repeat(SORT_KEY_MAX_LENGTH - 2);
    const before = `${stem}1`;
    const after = `${stem}2`;

    const key = keyBetween(before, after);

    expect(before < key && key < after).toBe(true);
    expect(key.length).toBeGreaterThan(SORT_KEY_MAX_LENGTH);
  });

  it("ne recopie pas la valeur reçue dans le message d'erreur", () => {
    let message = "";

    try {
      keyBetween("secret!", null);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe("Invalid sort key.");
  });
});

describe("keysFor", () => {
  it("rend un tableau vide pour zéro clé", () => {
    expect(keysFor(0)).toEqual([]);
  });

  it.each([1, 2, 3, 61, 62, 63, 200, 1000, 5000])(
    "rend %i clés valides, strictement croissantes",
    (count) => {
      const keys = keysFor(count);

      expect(keys).toHaveLength(count);
      expect(isStrictlyIncreasing(keys)).toBe(true);
      expect(keys.every((key) => VALID_KEY.test(key))).toBe(true);
    },
  );

  it("rend des clés courtes pour une colonne pleine (200 cartes, 3 caractères au plus)", () => {
    expect(longest(keysFor(200))).toBeLessThanOrEqual(3);
  });

  it("laisse insérer partout : avant la première, entre deux voisines, après la dernière", () => {
    const keys = keysFor(200);

    const inserted = [
      keyBetween(null, keys[0]!),
      ...keys.slice(1).map((key, index) => keyBetween(keys[index]!, key)),
      keyBetween(keys.at(-1)!, null),
    ];

    const merged = inserted.flatMap((key, index) =>
      index < keys.length ? [key, keys[index]!] : [key],
    );
    expect(merged).toHaveLength(401);
    expect(isStrictlyIncreasing(merged)).toBe(true);
    expect(merged.every((key) => VALID_KEY.test(key))).toBe(true);
    expect(longest(inserted)).toBeLessThanOrEqual(4);
  });

  it("rend le plafond de clés (10 000) en 4 caractères au plus et refuse au-delà", () => {
    const keys = keysFor(KEYS_FOR_MAX);

    expect(KEYS_FOR_MAX).toBe(10_000);
    expect(isStrictlyIncreasing(keys)).toBe(true);
    expect(longest(keys)).toBeLessThanOrEqual(4);
    expect(() => keysFor(KEYS_FOR_MAX + 1)).toThrow("Invalid sort key count.");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuse le nombre de clés %d",
    (count) => {
      expect(() => keysFor(count)).toThrow("Invalid sort key count.");
    },
  );
});

describe("SORT_KEY_MAX_LENGTH", () => {
  it("est la longueur que porte la contrainte tasks_sort_key_check de la migration 0010", () => {
    const migration = readFileSync(
      "drizzle/0010_tasks_order_and_parent_checks.sql",
      "utf8",
    );

    const lengths = [
      ...migration.matchAll(/char_length\("tasks"\."sort_key"\) <= (\d+)/g),
    ].map((match) => Number(match[1]));

    expect(lengths).toEqual([SORT_KEY_MAX_LENGTH]);
  });
});
