import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BoardIds } from "./board-moves";
import type { BoardMove } from "./SortableBoard";
import {
  type CardReturn,
  FAILURE_NOTICE_MS,
  useBoardMoves,
} from "./use-board-moves";

const SAVED: BoardIds = {
  todo: ["a", "b", "c"],
  doing: ["d", "e"],
  done: ["f"],
};
const A_TO_DOING: BoardMove = {
  id: "a",
  toColumn: "doing",
  beforeId: null,
  afterId: "d",
};
const A_TO_DONE: BoardMove = {
  id: "a",
  toColumn: "done",
  beforeId: null,
  afterId: "f",
};

type SaveCall = { move: BoardMove; settle: (ok: boolean) => void };

/** Enregistrement tenu par le test : chaque appel attend d'être réglé (vrai = enregistré). */
function controllableSave() {
  const calls: SaveCall[] = [];
  const save = vi.fn(
    (move: BoardMove) =>
      new Promise<boolean>((resolve) => {
        calls.push({ move, settle: resolve });
      }),
  );
  return { save, calls };
}

type HarnessProps = {
  saved: BoardIds;
  save: (move: BoardMove) => Promise<boolean>;
  reducedMotion?: boolean;
};

/**
 * Le hook tel qu'un tableau l'utilise : cartes retrouvées par leur id, retour consommé dans un effet de mise en
 * page. jsdom ne calcule aucune géométrie : chaque colonne est décalée de 300 px, chaque carte de 60 px, d'après
 * le dernier tableau affiché.
 */
function renderBoardMoves(initialProps: HarnessProps) {
  const shown: { current: BoardIds } = { current: initialProps.saved };
  const returns: CardReturn[] = [];
  const elements = new Map<string, HTMLElement>();

  function cardElement(id: string) {
    const columns = Object.values(shown.current);
    const column = columns.findIndex((ids) => ids.includes(id));
    if (column < 0) return null;
    const element = elements.get(id) ?? document.createElement("div");
    elements.set(id, element);
    const left = column * 300;
    const top = columns[column].indexOf(id) * 60;
    element.getBoundingClientRect = () => ({ left, top }) as DOMRect;
    return element;
  }

  const hook = renderHook(
    ({ saved, save, reducedMotion = false }: HarnessProps) => {
      const moves = useBoardMoves({ saved, save, reducedMotion, cardElement });
      useLayoutEffect(() => {
        shown.current = moves.board;
        const back = moves.consumeReturn();
        if (back !== null) returns.push(back);
      });
      return moves;
    },
    { initialProps },
  );
  return { ...hook, returns, elements };
}

/** Dépose une carte, puis laisse partir l'enregistrement dont c'est le tour (aucune réponse encore). */
async function drop(
  result: { current: { move: (next: BoardMove) => void } },
  move: BoardMove,
) {
  await act(async () => result.current.move(move));
}

/** Laisse la file et React finir. */
async function flush() {
  await act(async () => {
    for (let turn = 0; turn < 5; turn++) await Promise.resolve();
  });
}

/** Règle un enregistrement, puis laisse la file et React finir. */
async function settle(call: SaveCall, ok: boolean) {
  call.settle(ok);
  await flush();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("file des déplacements optimistes d'un tableau", () => {
  it("affiche le tableau enregistré tant qu'aucune carte n'est déposée", () => {
    const { save } = controllableSave();

    const { result } = renderBoardMoves({ saved: SAVED, save });

    expect(result.current.board).toEqual(SAVED);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failure).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("garde la carte là où elle est lâchée, pendant l'enregistrement puis après", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });

    await drop(result, A_TO_DOING);

    // Juste après le dépôt, avant toute réponse.
    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.board.todo).toEqual(["b", "c"]);
    expect(result.current.pendingCount).toBe(1);
    await settle(calls[0], true);

    expect(calls[0].move).toBe(A_TO_DOING);
    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failure).toBeNull();
  });

  it("envoie deux dépôts l'un après l'autre, dans l'ordre : le second ne part qu'après la fin du premier", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });

    await drop(result, A_TO_DOING);
    await drop(result, A_TO_DONE);

    expect(result.current.board.done).toEqual(["a", "f"]);
    expect(result.current.pendingCount).toBe(2);
    expect(save).toHaveBeenCalledTimes(1);

    await settle(calls[0], true);

    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1].move).toBe(A_TO_DONE);
    expect(result.current.pendingCount).toBe(1);

    await settle(calls[1], true);

    expect(result.current.board.done).toEqual(["a", "f"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("à l'échec, ramène la carte à sa place, pose l'échec et donne le départ du retour", async () => {
    const { save, calls } = controllableSave();
    const { result, returns, elements } = renderBoardMoves({
      saved: SAVED,
      save,
    });
    await drop(result, A_TO_DOING);

    await settle(calls[0], false);

    expect(result.current.board).toEqual(SAVED);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failure).toBe(A_TO_DOING);
    // Lâchée en tête de la 2e colonne, revenue en tête de la 1re : départ à +300 px.
    expect(returns).toEqual([{ element: elements.get("a"), x: 300, y: 0 }]);
  });

  it("en mouvement réduit, ramène la carte sans départ à animer", async () => {
    const { save, calls } = controllableSave();
    const { result, returns } = renderBoardMoves({
      saved: SAVED,
      save,
      reducedMotion: true,
    });
    await drop(result, A_TO_DOING);

    await settle(calls[0], false);

    expect(result.current.board).toEqual(SAVED);
    expect(result.current.failure).toBe(A_TO_DOING);
    expect(returns).toEqual([]);
  });

  it("un enregistrement qui lève une erreur compte pour un échec, la file continue", async () => {
    const save = vi
      .fn<(move: BoardMove) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("panne"))
      .mockResolvedValue(true);
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await flush();

    expect(result.current.failure).toBe(A_TO_DOING);

    await drop(result, {
      id: "b",
      toColumn: "done",
      beforeId: null,
      afterId: "f",
    });
    await flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.board.done).toEqual(["b", "f"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("échec d'un dépôt dépassé par un dépôt plus récent de la même carte : ni retour ni échec", async () => {
    const { save, calls } = controllableSave();
    const { result, returns } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await drop(result, A_TO_DONE);

    await settle(calls[0], false);

    expect(result.current.failure).toBeNull();
    expect(result.current.board.done).toEqual(["a", "f"]);
    expect(returns).toEqual([]);

    await settle(calls[1], true);

    expect(result.current.board.done).toEqual(["a", "f"]);
    expect(result.current.board.doing).toEqual(["d", "e"]);
    expect(result.current.failure).toBeNull();
  });

  it("à l'échec d'une carte, garde à sa place la carte déposée juste sous elle", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await drop(result, {
      id: "b",
      toColumn: "doing",
      beforeId: "a",
      afterId: "d",
    });

    await settle(calls[0], false);
    await settle(calls[1], true);

    expect(result.current.board.doing).toEqual(["b", "d", "e"]);
    expect(result.current.board.todo).toEqual(["a", "c"]);
    expect(result.current.failure).toBe(A_TO_DOING);
  });

  it("Réessayer rejoue le même déplacement et efface l'échec", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], false);

    await act(async () => result.current.retry());

    expect(result.current.failure).toBeNull();
    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.pendingCount).toBe(1);
    await settle(calls[1], true);

    expect(calls[1].move).toBe(A_TO_DOING);
    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("Réessayer sans échec : rien ne part", () => {
    const { save } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });

    act(() => result.current.retry());

    expect(save).not.toHaveBeenCalled();
    expect(result.current.pendingCount).toBe(0);
  });

  it("efface l'échec après 5 s", async () => {
    vi.useFakeTimers();
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FAILURE_NOTICE_MS - 1);
    });

    expect(result.current.failure).toBe(A_TO_DOING);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(FAILURE_NOTICE_MS).toBe(5000);
    expect(result.current.failure).toBeNull();
  });

  it("efface l'échec au déplacement suivant", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], false);

    await drop(result, {
      id: "b",
      toColumn: "done",
      beforeId: null,
      afterId: "f",
    });

    expect(result.current.failure).toBeNull();
  });

  it("efface l'échec sur demande", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], false);

    act(() => result.current.dismissFailure());

    expect(result.current.failure).toBeNull();
    expect(result.current.board).toEqual(SAVED);
  });

  it("tableau enregistré remplacé pendant une attente : le déplacement en attente est rejoué dessus", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    const refreshed: BoardIds = {
      todo: ["a", "c", "g"],
      doing: ["d", "b", "e"],
      done: ["f"],
    };

    rerender({ saved: refreshed, save });

    expect(result.current.board).toEqual({
      todo: ["c", "g"],
      doing: ["a", "d", "b", "e"],
      done: ["f"],
    });
    expect(result.current.pendingCount).toBe(1);
    await settle(calls[0], true);

    expect(result.current.board.doing).toEqual(["a", "d", "b", "e"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("tableau enregistré remplacé après un enregistrement réussi : le nouveau tableau fait foi", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], true);
    const refreshed: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "a", "e"],
      done: ["f"],
    };

    rerender({ saved: refreshed, save });

    expect(result.current.board).toEqual(refreshed);
  });

  it("tableau remplacé puis échec du déplacement en attente : la carte prend la place du nouveau tableau", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    const refreshed: BoardIds = {
      todo: ["b", "a", "c"],
      doing: ["d", "e"],
      done: ["f"],
    };
    rerender({ saved: refreshed, save });

    await settle(calls[0], false);

    expect(result.current.board).toEqual(refreshed);
    expect(result.current.failure).toBe(A_TO_DOING);
  });

  it("carte disparue du tableau enregistré : déplacement abandonné sans erreur, même si l'enregistrement échoue", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender, returns } = renderBoardMoves({
      saved: SAVED,
      save,
    });
    await drop(result, A_TO_DOING);
    const withoutCard: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "e"],
      done: ["f"],
    };

    rerender({ saved: withoutCard, save });

    expect(result.current.board).toEqual(withoutCard);
    await settle(calls[0], false);

    expect(result.current.board).toEqual(withoutCard);
    expect(result.current.failure).toBeNull();
    expect(result.current.pendingCount).toBe(0);
    expect(returns).toEqual([]);
  });

  it("carte disparue, enregistrement réussi : elle ne revient pas dans le tableau", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    const withoutCard: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "e"],
      done: ["f"],
    };
    rerender({ saved: withoutCard, save });

    await settle(calls[0], true);

    expect(result.current.board).toEqual(withoutCard);
  });

  it("démontage pendant un enregistrement : l'enregistrement en file part quand même, aucun état mis à jour, aucun avertissement", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { save, calls } = controllableSave();
    const { result, unmount, returns } = renderBoardMoves({
      saved: SAVED,
      save,
    });
    await drop(result, A_TO_DOING);
    await drop(result, {
      id: "b",
      toColumn: "done",
      beforeId: null,
      afterId: "f",
    });
    const atUnmount = result.current;

    unmount();
    await settle(calls[0], false);
    await settle(calls[1], true);

    // Les dépôts déjà faits restent dus : le second est envoyé après le premier.
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(atUnmount);
    expect(returns).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("démontage avec un échec affiché : le minuteur d'effacement est retiré", async () => {
    vi.useFakeTimers();
    const { save, calls } = controllableSave();
    const { result, unmount } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], false);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
