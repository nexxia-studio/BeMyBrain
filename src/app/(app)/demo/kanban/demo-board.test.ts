import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMove, simulateSave } from "./demo-board";

const BOARD = {
  backlog: [],
  unstarted: ["a", "b", "c"],
  started: ["d", "e"],
  completed: [],
  canceled: [],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("application d'un déplacement de la démo", () => {
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

  it("ne modifie pas le tableau d'origine", () => {
    applyMove(BOARD, {
      id: "a",
      toColumn: "started",
      beforeId: null,
      afterId: null,
    });

    expect(BOARD.unstarted).toEqual(["a", "b", "c"]);
  });
});

describe("sauvegarde simulée de la démo", () => {
  it("réussit après la latence choisie", async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    void simulateSave({ latencyMs: 1000, fail: false }).then(done);
    await vi.advanceTimersByTimeAsync(999);

    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(done).toHaveBeenCalledWith(true);
  });

  it("échoue quand l'échec est demandé", async () => {
    vi.useFakeTimers();

    const result = simulateSave({ latencyMs: 0, fail: true });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
  });
});
