import { afterEach, describe, expect, it, vi } from "vitest";

import { applyMove } from "@/components/kanban/board-moves";

import { simulateSave, statusMove, statusOf } from "./demo-board";

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

describe("changement de statut depuis le détail de la démo", () => {
  it("donne le statut d'une carte : la colonne où elle se trouve", () => {
    expect(statusOf(BOARD, "e")).toBe("started");
    expect(statusOf(BOARD, "inconnue")).toBeUndefined();
  });

  it("déplace la carte en tête de la colonne du nouveau statut", () => {
    const move = statusMove(BOARD, "b", "started");

    expect(move).toEqual({
      id: "b",
      toColumn: "started",
      beforeId: null,
      afterId: "d",
    });
    expect(applyMove(BOARD, move!).started).toEqual(["b", "d", "e"]);
  });

  it("vers une colonne vide : ni voisine au-dessus ni en dessous", () => {
    expect(statusMove(BOARD, "b", "completed")).toEqual({
      id: "b",
      toColumn: "completed",
      beforeId: null,
      afterId: null,
    });
  });

  it("même statut : aucun déplacement", () => {
    expect(statusMove(BOARD, "b", "unstarted")).toBeNull();
  });
});
