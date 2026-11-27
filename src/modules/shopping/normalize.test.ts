import { describe, expect, it } from "vitest";

import { normalizeLabel } from "./normalize";

const norm = (label: string) => normalizeLabel(label).normalized;

describe("normalisation d'un libellé de courses", () => {
  it("passe en minuscules et retire les accents", () => {
    expect(norm("Crème Fraîche")).toBe("creme fraiche");
  });

  it("transforme apostrophes et ponctuation en espaces réduits", () => {
    expect(norm("  Lait   d'avoine, (bio) !  ")).toBe("lait d avoine bio");
  });

  it("retire une quantité en tête", () => {
    expect(norm("2 lait")).toBe("lait");
    expect(norm("500 g farine")).toBe("farine");
    expect(norm("1,5 l eau")).toBe("eau");
    expect(norm("3x yaourts")).toBe("yaourts");
    expect(norm("2 kg de pommes")).toBe("pommes");
  });

  it("retire une quantité en queue", () => {
    expect(norm("lait x2")).toBe("lait");
    expect(norm("farine 500 g")).toBe("farine");
    expect(norm("eau 1.5 l")).toBe("eau");
  });

  it("garde une unité isolée qui fait partie du libellé", () => {
    expect(norm("l eau")).toBe("l eau");
    expect(norm("2")).toBe("2");
  });

  it("garde le libellé affiché tel que saisi", () => {
    expect(normalizeLabel("  2 Lait Écrémé ").display).toBe("2 Lait Écrémé");
  });

  it("propose les formes avec et sans s ou x final", () => {
    expect(normalizeLabel("pommes").forms).toEqual(["pommes", "pomme"]);
    expect(normalizeLabel("choux").forms).toEqual(["choux", "chou"]);
    expect(normalizeLabel("oeufs").forms).toEqual(["oeufs", "oeuf"]);
    expect(normalizeLabel("lait").forms).toEqual(["lait"]);
  });

  it("rend les mots du libellé normalisé", () => {
    expect(normalizeLabel("Papier toilette x3").words).toEqual(["papier", "toilette"]);
  });

  it("renvoie des listes vides pour un libellé vide", () => {
    expect(normalizeLabel(" !! ")).toEqual({ display: "!!", normalized: "", words: [], forms: [] });
  });
});
