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

const B_TO_DONE: BoardMove = {
  id: "b",
  toColumn: "done",
  beforeId: null,
  afterId: "f",
};
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
  onSaveError?: (error: unknown) => void;
  /** Le composant appelant refait le tableau à chaque rendu : nouvelle référence, même contenu. */
  recreateSaved?: boolean;
};

function copyOf(board: BoardIds): BoardIds {
  return Object.fromEntries(
    Object.entries(board).map(([column, ids]) => [column, [...ids]]),
  );
}

/**
 * Le hook tel qu'un tableau l'utilise : cartes retrouvées par leur id, retour consommé dans un effet de mise en
 * page. jsdom ne calcule aucune géométrie : chaque colonne est décalée de 300 px, chaque carte de 60 px, d'après
 * le dernier tableau affiché.
 */
function renderBoardMoves(
  initialProps: HarnessProps,
  { measure }: { measure?: (id: string) => HTMLElement | null } = {},
) {
  const shown: { current: BoardIds } = { current: initialProps.saved };
  const returns: CardReturn[] = [];
  const elements = new Map<string, HTMLElement>();

  const cardElement = vi.fn((id: string) => {
    if (measure) return measure(id);
    const columns = Object.values(shown.current);
    const column = columns.findIndex((ids) => ids.includes(id));
    if (column < 0) return null;
    const element = elements.get(id) ?? document.createElement("div");
    elements.set(id, element);
    const left = column * 300;
    const top = columns[column].indexOf(id) * 60;
    element.getBoundingClientRect = () => ({ left, top }) as DOMRect;
    return element;
  });

  const hook = renderHook(
    ({
      saved,
      save,
      reducedMotion = false,
      onSaveError,
      recreateSaved = false,
    }: HarnessProps) => {
      const moves = useBoardMoves({
        saved: recreateSaved ? copyOf(saved) : saved,
        save,
        reducedMotion,
        cardElement,
        onSaveError,
      });
      useLayoutEffect(() => {
        shown.current = moves.board;
        const back = moves.consumeReturn();
        if (back !== null) returns.push(back);
      });
      return moves;
    },
    { initialProps },
  );
  return { ...hook, returns, elements, cardElement };
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

  it("un enregistrement qui lève malgré son contrat : échec, retour, erreur remise une fois à l'appelant, et le dépôt suivant part", async () => {
    const failure = new Error("panne");
    const save = vi
      .fn<(move: BoardMove) => Promise<boolean>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(true);
    const onSaveError = vi.fn();
    const { result, returns, elements } = renderBoardMoves({
      saved: SAVED,
      save,
      onSaveError,
    });

    // Dépôt affiché d'abord, comme à l'écran : l'échec arrive après ce rendu.
    act(() => result.current.move(A_TO_DOING));
    await flush();

    expect(result.current.board).toEqual(SAVED);
    expect(result.current.failure).toBe(A_TO_DOING);
    expect(returns).toEqual([{ element: elements.get("a"), x: 300, y: 0 }]);
    expect(onSaveError).toHaveBeenCalledTimes(1);
    expect(onSaveError).toHaveBeenCalledWith(failure);

    await drop(result, B_TO_DONE);
    await flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.board.done).toEqual(["b", "f"]);
    expect(result.current.pendingCount).toBe(0);
    expect(onSaveError).toHaveBeenCalledTimes(1);
  });

  it("un enregistrement qui lève sans `onSaveError` : échec, la file continue", async () => {
    const save = vi
      .fn<(move: BoardMove) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("panne"))
      .mockResolvedValue(true);
    const { result } = renderBoardMoves({ saved: SAVED, save });

    await drop(result, A_TO_DOING);
    await flush();
    await drop(result, B_TO_DONE);
    await flush();

    expect(result.current.board.done).toEqual(["b", "f"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("relevé de la carte qui lève à l'échec : attente retirée, échec posé sans retour, erreur remise à l'appelant, et le dépôt suivant se termine", async () => {
    const broken = new Error("mesure impossible");
    const { save, calls } = controllableSave();
    const onSaveError = vi.fn();
    const { result, returns } = renderBoardMoves(
      { saved: SAVED, save, onSaveError },
      {
        measure: () => {
          throw broken;
        },
      },
    );
    await drop(result, A_TO_DOING);
    await drop(result, B_TO_DONE);

    await settle(calls[0], false);

    expect(result.current.pendingCount).toBe(1);
    expect(result.current.failure).toBe(A_TO_DOING);
    expect(returns).toEqual([]);
    expect(onSaveError).toHaveBeenCalledTimes(1);
    expect(onSaveError).toHaveBeenCalledWith(broken);
    expect(save).toHaveBeenCalledTimes(2);

    await settle(calls[1], true);

    expect(result.current.pendingCount).toBe(0);
    expect(result.current.board.done).toEqual(["b", "f"]);
  });

  it("`onSaveError` qui lève à son tour : la file continue", async () => {
    const save = vi
      .fn<(move: BoardMove) => Promise<boolean>>()
      .mockRejectedValueOnce(new Error("panne"))
      .mockResolvedValue(true);
    // L'erreur relancée par l'appelant sort de la file en rejet non géré : attrapé ici pour ce test seulement.
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const { result } = renderBoardMoves({
      saved: SAVED,
      save,
      onSaveError: (error) => {
        throw error;
      },
    });

    await drop(result, A_TO_DOING);
    await flush();
    await drop(result, B_TO_DONE);
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);

    expect(result.current.board.done).toEqual(["b", "f"]);
    expect(result.current.pendingCount).toBe(0);
    expect(unhandled).toHaveBeenCalledTimes(1);
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

  it("tableau enregistré remplacé pendant une attente : le déplacement en attente est rejoué dessus tant que l'attente dure", async () => {
    const { save } = controllableSave();
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
  });

  it("tableau du serveur reçu avant la réponse, carte à la place demandée : aucun saut, aucun double placement ; le tableau suivant fait foi", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    const fromServer: BoardIds = {
      todo: ["b", "c"],
      doing: ["a", "d", "e"],
      done: ["f"],
    };

    rerender({ saved: fromServer, save });

    expect(result.current.board).toEqual(fromServer);
    await settle(calls[0], true);

    expect(result.current.board).toEqual(fromServer);
    expect(result.current.pendingCount).toBe(0);
    const next: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "a", "e"],
      done: ["f"],
    };
    rerender({ saved: next, save });

    expect(result.current.board).toEqual(next);
  });

  it("tableau reçu avant la réponse, carte placée ailleurs que demandé : le dépôt reste affiché jusqu'au premier tableau reçu après la réussite", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, {
      id: "a",
      toColumn: "doing",
      beforeId: "d",
      afterId: "e",
    });
    const early: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "e", "a"],
      done: ["f"],
    };

    rerender({ saved: early, save });
    await settle(calls[0], true);

    // Reçu avant la réussite : rien ne dit qu'il connaît ce dépôt.
    expect(result.current.board.doing).toEqual(["d", "a", "e"]);
    const afterSuccess: BoardIds = {
      todo: ["b", "c", "g"],
      doing: ["d", "e", "a"],
      done: ["f"],
    };
    rerender({ saved: afterSuccess, save });

    expect(result.current.board).toEqual(afterSuccess);
  });

  it("réussite, puis tableau du serveur avec la carte ailleurs que demandé (tête de la colonne) : le serveur fait foi", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, {
      id: "a",
      toColumn: "done",
      beforeId: "f",
      afterId: null,
    });
    await settle(calls[0], true);

    expect(result.current.board.done).toEqual(["f", "a"]);
    const fromServer: BoardIds = {
      todo: ["b", "c"],
      doing: ["d", "e"],
      done: ["a", "f"],
    };
    rerender({ saved: fromServer, save });

    expect(result.current.board).toEqual(fromServer);
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

  it("deux dépôts rapides de cartes différentes, tableau du premier reçu pendant l'enregistrement du second : la seconde carte ne recule jamais, puis son tableau fait foi", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    const shown = { todo: ["c"], doing: ["a", "d", "e"], done: ["b", "f"] };
    await drop(result, B_TO_DONE);
    await drop(result, A_TO_DOING);

    expect(result.current.board).toEqual(shown);
    await settle(calls[0], true);

    expect(result.current.board).toEqual(shown);
    // Tableau rafraîchi du premier dépôt : il ne connaît pas encore le second.
    rerender({
      saved: { todo: ["a", "c"], doing: ["d", "e"], done: ["b", "f"] },
      save,
    });

    expect(result.current.board).toEqual(shown);
    expect(result.current.pendingCount).toBe(1);
    await settle(calls[1], true);

    expect(result.current.board).toEqual(shown);
    expect(result.current.pendingCount).toBe(0);
    // Tableau rafraîchi du second dépôt : le serveur a rangé la carte ailleurs que demandé.
    const afterSecond: BoardIds = {
      todo: ["c"],
      doing: ["d", "a", "e"],
      done: ["b", "f"],
    };
    rerender({ saved: afterSecond, save });

    expect(result.current.board).toEqual(afterSecond);
  });

  it("deux dépôts de la même carte, tableau du premier reçu pendant l'enregistrement du second : la carte reste à la place du second", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await drop(result, A_TO_DONE);
    await settle(calls[0], true);

    rerender({
      saved: { todo: ["b", "c"], doing: ["a", "d", "e"], done: ["f"] },
      save,
    });

    expect(result.current.board).toEqual({
      todo: ["b", "c"],
      doing: ["d", "e"],
      done: ["a", "f"],
    });
    await settle(calls[1], true);

    expect(result.current.board.done).toEqual(["a", "f"]);
    expect(result.current.board.doing).toEqual(["d", "e"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("réussite sans aucun tableau nouveau ensuite : la carte reste où elle a été déposée, plus rien en attente", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], true);

    rerender({ saved: SAVED, save });

    expect(result.current.board).toEqual({
      todo: ["b", "c"],
      doing: ["a", "d", "e"],
      done: ["f"],
    });
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.failure).toBeNull();
  });

  it("dépôt confirmé puis échec d'un dépôt suivant : seule la carte en échec revient, le dépôt confirmé reste affiché", async () => {
    const { save, calls } = controllableSave();
    const { result } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, B_TO_DONE);
    await settle(calls[0], true);
    await drop(result, A_TO_DOING);

    await settle(calls[1], false);

    expect(result.current.board).toEqual({
      todo: ["a", "c"],
      doing: ["d", "e"],
      done: ["b", "f"],
    });
    expect(result.current.failure).toBe(A_TO_DOING);
  });

  it("nouvelle référence au contenu identique (rendu du parent sans nouvelles données) : le dépôt réussi reste affiché", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);
    await settle(calls[0], true);

    rerender({ saved: copyOf(SAVED), save });

    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.board.todo).toEqual(["b", "c"]);
  });

  it("nouvelle référence au contenu identique pendant une attente : ne compte pas pour un tableau du serveur, la réussite est gardée", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({ saved: SAVED, save });
    await drop(result, A_TO_DOING);

    rerender({ saved: copyOf(SAVED), save });
    await settle(calls[0], true);

    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
  });

  it("tableau refait à chaque rendu par l'appelant, à contenu égal : aucune boucle de rendu, le dépôt réussi reste affiché", async () => {
    const { save, calls } = controllableSave();
    const { result, rerender } = renderBoardMoves({
      saved: SAVED,
      save,
      recreateSaved: true,
    });

    await drop(result, A_TO_DOING);
    await settle(calls[0], true);
    rerender({ saved: SAVED, save, recreateSaved: true });

    expect(result.current.board.doing).toEqual(["a", "d", "e"]);
    expect(result.current.pendingCount).toBe(0);
  });

  it("démontage pendant un enregistrement : l'enregistrement en file part quand même, mais ni relevé de carte, ni erreur remise, ni état mis à jour", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const save = vi
      .fn<(move: BoardMove) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("panne"));
    const onSaveError = vi.fn();
    const { result, unmount, returns, cardElement } = renderBoardMoves({
      saved: SAVED,
      save,
      onSaveError,
    });
    act(() => result.current.move(A_TO_DOING));
    act(() => result.current.move(B_TO_DONE));
    const atUnmount = result.current;

    unmount();
    await flush();
    await flush();

    // Les dépôts déjà faits restent dus : le second est envoyé après le premier.
    expect(save).toHaveBeenCalledTimes(2);
    expect(cardElement).not.toHaveBeenCalled();
    expect(onSaveError).not.toHaveBeenCalled();
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
