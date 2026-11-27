import { describe, expect, it } from "vitest";

import { classifyAisle } from "./classify";
import { normalizeLabel } from "./normalize";
import { REFERENCE_SET } from "./aisles/reference-set";

const none = { overrides: new Map<string, never>() };

describe("classifyAisle", () => {
  it("la correction mémorisée l'emporte sur le dictionnaire", () => {
    const overrides = new Map([["pomme", "household" as const]]);
    expect(classifyAisle("Pommes", { overrides })).toEqual({ aisle: "produce", source: "dictionary" });
    expect(classifyAisle("pomme", { overrides })).toEqual({ aisle: "household", source: "override" });
    expect(classifyAisle("2 Pomme", { overrides })).toEqual({ aisle: "household", source: "override" });
  });

  it("le dictionnaire l'emporte sur Divers", () => {
    expect(classifyAisle("lait", none)).toEqual({ aisle: "dairyEggs", source: "dictionary" });
  });

  it("Divers en dernier recours", () => {
    expect(classifyAisle("bidule", none)).toEqual({ aisle: "other", source: "fallback" });
    expect(classifyAisle("", none)).toEqual({ aisle: "other", source: "fallback" });
  });

  it("range les cas d'acceptation de la spec", () => {
    expect(classifyAisle("pomme", none).aisle).toBe("produce");
    expect(classifyAisle("déo", none).aisle).toBe("hygiene");
    expect(classifyAisle("déodorant", none).aisle).toBe("hygiene");
    for (const y of ["yaourt", "yogourt", "yoghourt"]) expect(classifyAisle(y, none).aisle).toBe("dairyEggs");
    expect(classifyAisle("PQ", none).aisle).toBe("household");
  });

  it("l'expression la plus longue l'emporte", () => {
    expect(classifyAisle("pomme de terre", none).aisle).toBe("produce");
    expect(classifyAisle("lait de coco", none)).toEqual({ aisle: "pantrySavory", source: "dictionary" });
    expect(classifyAisle("lait d'avoine", none).aisle).toBe("drinks");
    expect(classifyAisle("Œufs x12", none).aisle).toBe("dairyEggs");
    expect(classifyAisle("haricots verts", none).aisle).toBe("produce");
  });

  it("essaie le singulier de chaque mot d'une expression", () => {
    expect(classifyAisle("petits pois", none).aisle).toBe("produce");
    expect(classifyAisle("haricots blancs", none).aisle).toBe("pantrySavory");
    expect(classifyAisle("sacs congélation", none).aisle).toBe("household");
    expect(classifyAisle("haricots verts en boîte", none).aisle).toBe("pantrySavory");
    expect(classifyAisle("2 sacs poubelle", none).aisle).toBe("household");
  });

  it("classe au moins 95 % du jeu de référence comme attendu", () => {
    const wrong = REFERENCE_SET.filter((r) => classifyAisle(r.label, none).aisle !== r.expected).map((r) => r.label);
    expect(wrong.length / REFERENCE_SET.length, wrong.join(", ")).toBeLessThanOrEqual(0.05);
  });

  it("cherche la correction par libellé normalisé complet", () => {
    const key = normalizeLabel("Lait Écrémé x2").normalized;
    const overrides = new Map([[key, "drinks" as const]]);
    expect(classifyAisle("2 LAIT ecremé", { overrides }).source).toBe("override");
  });
});
