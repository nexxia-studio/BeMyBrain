import { describe, expect, it } from "vitest";

import type { UserTx } from "@/db/client";

import { addItem, cleanLabel } from "./mutations";

// Refus du libellé avant toute requête : la transaction factice échoue si elle est touchée.
const untouchedTx = new Proxy(
  {},
  {
    get() {
      throw new Error("transaction touchée");
    },
  },
) as unknown as UserTx;

const WORKSPACE = "00000000-0000-4000-8000-000000000001";

async function refusal(label: string) {
  return addItem(WORKSPACE, label, untouchedTx).then(
    () => null,
    (e: unknown) => e,
  );
}

describe("addItem : caractères de format et libellé sans caractère visible", () => {
  it.each([
    ["espace de largeur nulle U+200B", "pa\u200bin"],
    ["inversion U+202E", "pain\u202e"],
    ["isolat U+2066", "\u2066pain"],
    ["isolat U+2069", "pain\u2069"],
    ["joint insécable U+2060", "pa\u2060in"],
  ])("refuse %s en invalid_params", async (_name, label) => {
    expect(await refusal(label)).toMatchObject({ code: "invalid_params" });
  });

  it.each([
    ["que des espaces", "   \t "],
    ["que des espaces insécables", "\u00a0\u2003"],
    ["une marque combinante seule", "\u0301"],
  ])("refuse un libellé de %s en invalid_params", async (_name, label) => {
    expect(await refusal(label)).toMatchObject({ code: "invalid_params" });
  });
});

describe("addItem : caractères de contrôle du libellé", () => {
  it.each([
    ["NUL", "pa\u0000in"],
    ["cloche", "pa\u0007in"],
    ["DEL", "pa\u007fin"],
    ["NUL seul", "\u0000"],
  ])("refuse un libellé avec %s en invalid_params", async (_name, label) => {
    const error = await addItem(WORKSPACE, label, untouchedTx).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ code: "invalid_params" });
  });
});

describe("cleanLabel : forme normalisée", () => {
  it("normalise en NFC", () => {
    expect(cleanLabel("cafe\u0301")).toBe("caf\u00e9");
  });

  it("compte la longueur après NFC (80 « é » décomposés passent)", () => {
    expect(cleanLabel("e\u0301".repeat(80))).toHaveLength(80);
  });

  it("refuse 81 caractères en label_too_long", () => {
    expect(() => cleanLabel("a".repeat(81))).toThrow(
      expect.objectContaining({ code: "label_too_long" }),
    );
  });

  it("garde un libellé fait de ponctuation ou de symboles", () => {
    expect(cleanLabel("  ?  ")).toBe("?");
    expect(cleanLabel("\u{1F95B}")).toBe("\u{1F95B}");
  });
});
