import { describe, expect, it } from "vitest";

import { applyMove, boardHas } from "./board-moves";

const BOARD = {
  backlog: [],
  unstarted: ["a", "b", "c"],
  started: ["d", "e"],
  completed: [],
};

describe("application d'un déplacement à un tableau d'identifiants", () => {
  it("place la carte juste après sa voisine du dessus, dans sa nouvelle colonne", () => {
    const next = applyMove(BOARD, {
      id: "a",
      toColumn: "started",
      beforeId: "d",
      afterId: "e",
    });

    expect(next.unstarted).toEqual(["b", "c"]);
    expect(next.started).toEqual(["d", "a", "e"]);
  });

  it("place la carte en tête quand elle n'a pas de voisine au-dessus", () => {
    const next = applyMove(BOARD, {
      id: "c",
      toColumn: "unstarted",
      beforeId: null,
      afterId: "a",
    });

    expect(next.unstarted).toEqual(["c", "a", "b"]);
  });

  it("se cale sur la voisine du dessous quand celle du dessus a quitté la colonne", () => {
    const next = applyMove(BOARD, {
      id: "a",
      toColumn: "started",
      beforeId: "x",
      afterId: "e",
    });

    expect(next.started).toEqual(["d", "a", "e"]);
  });

  it("met la carte en fin de colonne quand aucune voisine n'y est plus", () => {
    const next = applyMove(BOARD, {
      id: "a",
      toColumn: "started",
      beforeId: "x",
      afterId: "y",
    });

    expect(next.started).toEqual(["d", "e", "a"]);
  });

  it("ne modifie pas le tableau d'origine et garde l'ordre des colonnes", () => {
    const next = applyMove(BOARD, {
      id: "a",
      toColumn: "started",
      beforeId: null,
      afterId: null,
    });

    expect(BOARD.unstarted).toEqual(["a", "b", "c"]);
    expect(Object.keys(next)).toEqual(Object.keys(BOARD));
  });

  it("rejoué sur un tableau qui le contient déjà, le déplacement ne change rien", () => {
    const move = { id: "a", toColumn: "started", beforeId: "d", afterId: "e" };

    const once = applyMove(BOARD, move);

    expect(applyMove(once, move)).toEqual(once);
  });

  it("carte absente du tableau : tableau rendu tel quel", () => {
    const next = applyMove(BOARD, {
      id: "disparue",
      toColumn: "started",
      beforeId: null,
      afterId: "d",
    });

    expect(next).toBe(BOARD);
  });

  it("colonne d'arrivée inconnue : tableau rendu tel quel", () => {
    const next = applyMove(BOARD, {
      id: "a",
      toColumn: "ailleurs",
      beforeId: null,
      afterId: null,
    });

    expect(next).toBe(BOARD);
  });
});

describe("présence d'une carte dans un tableau", () => {
  it("vraie dans n'importe quelle colonne, fausse sinon", () => {
    expect(boardHas(BOARD, "e")).toBe(true);
    expect(boardHas(BOARD, "inconnue")).toBe(false);
  });
});
