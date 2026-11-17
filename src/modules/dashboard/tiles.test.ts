import { describe, expect, it } from "vitest";

import { buildDashboard } from "./tiles";

const PERSO = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Perso" };
const FAMILLE = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Famille" };
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

describe("tuiles du tableau de bord", () => {
  it("côté Pro, ne renvoie que des tuiles du côté Pro", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [TRUSTUP.id, NEXXIA.id],
    });

    expect(dashboard.tiles.length).toBeGreaterThan(0);
    expect(dashboard.tiles.every((tile) => tile.side === "pro")).toBe(true);
  });

  it("côté Privé, ne renvoie que des tuiles du côté Privé", () => {
    const dashboard = buildDashboard({
      side: "private",
      contexts: [PERSO],
      selected: [PERSO.id],
    });

    expect(dashboard.tiles.length).toBeGreaterThan(0);
    expect(dashboard.tiles.every((tile) => tile.side === "private")).toBe(true);
  });

  it("aucune sorte de tuile n'apparaît des deux côtés sous le même type", () => {
    const pro = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP],
      selected: [TRUSTUP.id],
    });
    const privateSide = buildDashboard({
      side: "private",
      contexts: [PERSO],
      selected: [PERSO.id],
    });

    const proIds = new Set(pro.tiles.map((tile) => tile.id));
    expect(privateSide.tiles.filter((tile) => proIds.has(tile.id))).toEqual([]);
  });

  it("seules les tuiles qui mêlent plusieurs espaces les étiquettent (la To-do)", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [TRUSTUP.id, NEXXIA.id],
    });

    const labelled = dashboard.tiles
      .filter((tile) => tile.spaceLabels.length > 0)
      .map((tile) => tile.id);
    expect(labelled).toEqual(["proTodo"]);
  });

  it("le filtre d'espace restreint les espaces couverts par chaque tuile", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [NEXXIA.id],
    });

    expect(dashboard.spaces).toEqual(["Nexxia"]);
    expect(
      dashboard.tiles.every((tile) => tile.spaces.join() === "Nexxia"),
    ).toBe(true);
  });

  it("le filtre existe aussi côté Privé (plusieurs espaces privés)", () => {
    const dashboard = buildDashboard({
      side: "private",
      contexts: [PERSO, FAMILLE],
      selected: [FAMILLE.id],
    });

    expect(
      dashboard.tiles.every((tile) => tile.spaces.join() === "Famille"),
    ).toBe(true);
  });

  it("sans filtre (tous les espaces retenus), chaque tuile couvre les espaces dans leur ordre", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [NEXXIA.id, TRUSTUP.id],
    });

    expect(dashboard.tiles[0]?.spaceLabels).toEqual(["Trustup", "Nexxia"]);
  });

  it("un côté à un seul espace n'étiquette pas ses tuiles (rien à distinguer)", () => {
    const dashboard = buildDashboard({
      side: "private",
      contexts: [PERSO],
      selected: [PERSO.id],
    });

    expect(dashboard.spaces).toEqual(["Perso"]);
    expect(dashboard.tiles.every((tile) => tile.spaceLabels.length === 0)).toBe(
      true,
    );
  });

  it("un côté sans espace n'a aucune tuile", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [],
      selected: [],
    });

    expect(dashboard.tiles).toEqual([]);
    expect(dashboard.spaces).toEqual([]);
  });

  it("ignore une sélection qui ne désigne aucun espace du côté", () => {
    const dashboard = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [PERSO.id],
    });

    expect(dashboard.spaces).toEqual(["Trustup", "Nexxia"]);
  });

  it("place au plus une paire de tuiles chiffre (une colonne sur mobile, DESIGN.md § 8)", () => {
    for (const side of ["private", "pro"] as const) {
      const dashboard = buildDashboard({
        side,
        contexts: [TRUSTUP],
        selected: [TRUSTUP.id],
      });

      const figures = dashboard.tiles.filter((tile) => tile.size === "figure");
      expect([0, 2]).toContain(figures.length);
    }
  });
});
