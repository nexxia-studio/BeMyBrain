import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import {
  type BoardColumn,
  type BoardMove,
  SortableBoard,
} from "./SortableBoard";

type Card = { id: string; title: string };

function column(
  id: string,
  titles: string[],
  extra: Partial<BoardColumn<Card>> = {},
): BoardColumn<Card> {
  return {
    id,
    label: id.toUpperCase(),
    items: titles.map((title) => ({ id: title, title })),
    ...extra,
  };
}

const COLUMNS = [column("todo", ["a", "b", "c"]), column("doing", ["d", "e"])];

function board(
  onMove: (move: BoardMove) => void = vi.fn(),
  columns: readonly BoardColumn<Card>[] = COLUMNS,
  extra: { layout?: "scroll" | "tabs"; locale?: "fr" | "en" } = {},
) {
  const locale = extra.locale ?? "fr";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <SortableBoard
        columns={columns}
        layout={extra.layout}
        getItemLabel={(card) => card.title}
        renderCard={(card) => <span>{card.title}</span>}
        onMove={onMove}
      />
    </NextIntlClientProvider>
  );
}

// jsdom ne calcule aucune géométrie : colonnes côte à côte (300 px), cartes empilées (60 px).
// Onglets au-dessus (100 px chacun). Le calque du glisser (DragOverlay) prend la place de la carte saisie.
function fakeRect(this: Element): DOMRect {
  const rect = (x: number, y: number, width: number, height: number) =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    }) as DOMRect;
  const columns = [...document.querySelectorAll("[data-board-column]")];
  const card = this.matches("[data-board-overlay], [data-board-overlay] *")
    ? document.querySelector('[data-board-card][aria-pressed="true"]')
    : this.closest("[data-board-card]");
  if (card) {
    const columnIndex = columns.indexOf(card.closest("[data-board-column]")!);
    const cards = [
      ...card
        .closest("[data-board-column]")!
        .querySelectorAll("[data-board-card]"),
    ];
    return rect(columnIndex * 300 + 10, 50 + cards.indexOf(card) * 60, 260, 50);
  }
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (tabs.includes(this)) return rect(tabs.indexOf(this) * 100, -60, 90, 40);
  const columnIndex = columns.indexOf(this);
  if (columnIndex >= 0) {
    const count = this.querySelectorAll("[data-board-card]").length;
    return rect(columnIndex * 300, 0, 280, 60 + count * 60);
  }
  return rect(0, 0, 0, 0);
}

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Dans les données de test, l'id d'une carte est son titre.
function cardHandle(id: string) {
  return document.querySelector(`[data-board-card="${id}"]`) as HTMLElement;
}

async function press(target: Element, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// La carte peut être remontée ailleurs (changement de colonne) : chaque touche vise la carte du moment.
async function dragWithKeyboard(title: string, codes: string[]) {
  cardHandle(title).focus();
  await press(cardHandle(title), "Space");
  for (const code of codes) await press(cardHandle(title), code);
  await press(cardHandle(title), "Space");
}

describe("SortableBoard", () => {
  it("affiche chaque colonne avec son libellé et ses cartes, dans l'ordre", () => {
    render(board());

    expect(screen.getByRole("heading", { name: /TODO/ })).toBeDefined();
    expect(
      [...document.querySelectorAll("[data-board-card]")].map(
        (card) => card.textContent,
      ),
    ).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("réordonne une carte au clavier et donne ses nouveaux voisins à onMove", async () => {
    const onMove = vi.fn();
    render(board(onMove));

    await dragWithKeyboard("a", ["ArrowDown"]);

    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      toColumn: "todo",
      beforeId: "b",
      afterId: "c",
    });
  });

  it("change une carte de colonne au clavier", async () => {
    const onMove = vi.fn();
    render(board(onMove));

    await dragWithKeyboard("b", ["ArrowRight"]);

    expect(onMove).toHaveBeenCalledTimes(1);
    const move = onMove.mock.calls[0][0] as BoardMove;
    expect(move.id).toBe("b");
    expect(move.toColumn).toBe("doing");
    expect([move.beforeId, move.afterId]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[de]$/)]),
    );
  });

  it("n'appelle pas onMove quand la carte revient à sa place", async () => {
    const onMove = vi.fn();
    render(board(onMove));

    await dragWithKeyboard("b", ["ArrowDown", "ArrowUp"]);

    expect(onMove).not.toHaveBeenCalled();
  });

  it("n'appelle pas onMove quand le déplacement est annulé par Échap", async () => {
    const onMove = vi.fn();
    render(board(onMove));
    const handle = cardHandle("a");
    handle.focus();

    await press(handle, "Space");
    await press(handle, "ArrowDown");
    await press(handle, "Escape");

    expect(onMove).not.toHaveBeenCalled();
  });

  it("place la carte en tête de la colonne quand elle est déposée sur une colonne repliée", async () => {
    const onMove = vi.fn();
    const columns = [
      column("todo", ["a", "b"]),
      column("canceled", ["x", "y"], { collapsed: true }),
    ];
    render(board(onMove, columns));

    await dragWithKeyboard("a", ["ArrowRight"]);

    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      toColumn: "canceled",
      beforeId: null,
      afterId: "x",
    });
  });

  it("dépose une carte dans une colonne vide au clavier", async () => {
    const onMove = vi.fn();
    render(board(onMove, [column("todo", ["a", "b"]), column("done", [])]));

    await dragWithKeyboard("a", ["ArrowRight"]);

    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      toColumn: "done",
      beforeId: null,
      afterId: null,
    });
  });

  it("une colonne repliée montre son libellé et son compteur, pas ses cartes", () => {
    const columns = [
      column("todo", ["a"]),
      column("canceled", ["x", "y"], { collapsed: true }),
    ];

    render(board(vi.fn(), columns));

    expect(screen.getByText("CANCELED")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.queryByText("x")).toBeNull();
  });

  it("en onglets, n'affiche que la colonne choisie et change de colonne au toucher d'un onglet", () => {
    render(board(vi.fn(), COLUMNS, { layout: "tabs" }));

    expect(screen.queryByText("d")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /DOING/ }));

    expect(screen.getByText("d")).toBeDefined();
    expect(screen.queryByText("a")).toBeNull();
  });

  it("en onglets, une carte déposée sur un onglet passe en tête de cette colonne", async () => {
    const onMove = vi.fn();
    render(board(onMove, COLUMNS, { layout: "tabs" }));

    // Géométrie factice : l'onglet DOING est le plus proche au-dessus de « a ».
    await dragWithKeyboard("a", ["ArrowUp"]);

    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      id: "a",
      toColumn: "doing",
      beforeId: null,
      afterId: "d",
    });
  });

  it.each([
    ["fr", fr.kanban.instructions],
    ["en", en.kanban.instructions],
  ] as const)(
    "donne les consignes du lecteur d'écran en %s",
    (locale, instructions) => {
      render(board(vi.fn(), COLUMNS, { locale }));

      expect(document.body.textContent).toContain(instructions);
    },
  );

  it("annonce la carte saisie, avec sa colonne et sa position", async () => {
    render(board());
    const handle = cardHandle("b");
    handle.focus();

    await press(handle, "Space");

    expect(document.body.textContent).toContain(
      "Carte « b » saisie, dans « TODO », position 2 sur 3.",
    );
  });

  it("s'hydrate après un rendu serveur sans avertissement ni erreur", async () => {
    const html = renderToString(board());
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");

    await act(async () => {
      hydrateRoot(container, board());
    });

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    container.remove();
  });
});
