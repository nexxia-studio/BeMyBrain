import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  extra: { locale?: "fr" | "en"; onOpen?: (id: string) => void } = {},
) {
  const locale = extra.locale ?? "fr";
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "fr" ? fr : en}
    >
      <SortableBoard
        columns={columns}
        getItemLabel={(card) => card.title}
        renderCard={(card) => <span>{card.title}</span>}
        onMove={onMove}
        onOpen={extra.onOpen}
      />
    </NextIntlClientProvider>
  );
}

// Largeur simulée : `wide` = au-delà de 768 px (colonnes), sinon onglets. jsdom ne lit pas le CSS de Tailwind :
// `matchMedia` répond selon `wide`, et un élément masqué par la mise en page (`md:hidden` au-delà, `hidden` en
// deçà) reçoit le rectangle vide d'un `display: none`.
let wide = true;

function stubWidth(isWide: boolean) {
  wide = isWide;
  vi.stubGlobal("matchMedia", () => ({
    matches: wide,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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
  if (this.closest(wide ? ".md\\:hidden" : ".hidden")) return rect(0, 0, 0, 0);
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
  stubWidth(true);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function columnSection(id: string) {
  return document.querySelector(`[data-board-column="${id}"]`) as HTMLElement;
}

// Sous 768 px, une colonne non choisie est masquée par la classe `hidden` (affichée par `md:flex` au-delà).
function shownWhenNarrow(id: string) {
  return !columnSection(id).classList.contains("hidden");
}

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

    // Géométrie factice : « e », à la hauteur de « b », est la carte la plus proche à droite.
    expect(onMove).toHaveBeenCalledExactlyOnceWith({
      id: "b",
      toColumn: "doing",
      beforeId: "d",
      afterId: "e",
    });
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

    const canceled = within(columnSection("canceled"));
    expect(canceled.getByText("CANCELED")).toBeDefined();
    expect(canceled.getByText("2")).toBeDefined();
    expect(screen.queryByText("x")).toBeNull();
  });

  it("une colonne affiche son total, au-delà des cartes affichées, puis son pied", () => {
    const columns = [
      column("todo", ["a"]),
      column("done", ["x", "y"], { total: 25, footer: <button>PIED</button> }),
    ];

    render(board(vi.fn(), columns));

    expect(screen.getByRole("heading", { name: /DONE/ }).textContent).toBe(
      "DONE25",
    );
    expect(screen.getByRole("button", { name: "PIED" })).toBeDefined();
  });

  describe("sous 768 px, en onglets", () => {
    beforeEach(() => {
      stubWidth(false);
    });

    it("l'onglet compte le total de la colonne", () => {
      const columns = [
        column("todo", ["a"]),
        column("done", ["x"], { total: 25 }),
      ];

      render(board(vi.fn(), columns));

      expect(screen.getByRole("tab", { name: /DONE/ }).textContent).toBe(
        "DONE25",
      );
    });

    it("n'affiche que la colonne choisie et change de colonne au toucher d'un onglet", () => {
      render(board(vi.fn(), COLUMNS));

      expect([shownWhenNarrow("todo"), shownWhenNarrow("doing")]).toEqual([
        true,
        false,
      ]);

      fireEvent.click(screen.getByRole("tab", { name: /DOING/ }));

      expect([shownWhenNarrow("todo"), shownWhenNarrow("doing")]).toEqual([
        false,
        true,
      ]);
    });

    it("chaque colonne est le panneau de son onglet", () => {
      render(board(vi.fn(), COLUMNS));

      const tab = screen.getByRole("tab", { name: /TODO/ });

      expect(tab.getAttribute("aria-controls")).toBe(columnSection("todo").id);
      expect(columnSection("todo").getAttribute("role")).toBe("tabpanel");
    });

    it("seul l'onglet choisi est dans l'ordre de tabulation", () => {
      render(board(vi.fn(), COLUMNS));

      expect(
        screen.getAllByRole("tab").map((tab) => tab.getAttribute("tabindex")),
      ).toEqual(["0", "-1"]);
    });

    it("les flèches passent d'un onglet à l'autre, en boucle, et affichent sa colonne", () => {
      render(board(vi.fn(), COLUMNS));
      const [todo, doing] = screen.getAllByRole("tab");
      todo.focus();

      fireEvent.keyDown(todo, { key: "ArrowRight" });

      expect(document.activeElement).toBe(doing);
      expect(doing.getAttribute("aria-selected")).toBe("true");
      expect(shownWhenNarrow("doing")).toBe(true);

      fireEvent.keyDown(doing, { key: "ArrowRight" });

      expect(document.activeElement).toBe(todo);

      fireEvent.keyDown(todo, { key: "ArrowLeft" });

      expect(document.activeElement).toBe(doing);
    });

    it("Fin choisit le dernier onglet et Début le premier", () => {
      render(board(vi.fn(), COLUMNS));
      const [todo, doing] = screen.getAllByRole("tab");
      todo.focus();

      fireEvent.keyDown(todo, { key: "End" });

      expect(document.activeElement).toBe(doing);
      expect(doing.getAttribute("aria-selected")).toBe("true");

      fireEvent.keyDown(doing, { key: "Home" });

      expect(document.activeElement).toBe(todo);
      expect(todo.getAttribute("aria-selected")).toBe("true");
    });

    it("revient à la première colonne quand la colonne choisie disparaît", () => {
      const { rerender } = render(board(vi.fn(), COLUMNS));
      fireEvent.click(screen.getByRole("tab", { name: /DOING/ }));

      rerender(board(vi.fn(), [COLUMNS[0]]));

      expect(shownWhenNarrow("todo")).toBe(true);
      expect(screen.getByRole("tab").getAttribute("aria-selected")).toBe(
        "true",
      );
    });

    it("une carte déposée sur un onglet passe en tête de cette colonne", async () => {
      const onMove = vi.fn();
      render(board(onMove, COLUMNS));

      // Géométrie factice : l'onglet DOING est le plus proche au-dessus de « a ».
      await dragWithKeyboard("a", ["ArrowUp"]);

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "doing",
        beforeId: null,
        afterId: "d",
      });
    });
  });

  describe("au-delà de 768 px, en colonnes", () => {
    it("aucune colonne n'est un panneau d'onglet", () => {
      render(board());

      expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(0);
    });

    it("les onglets masqués ne sont pas des cibles : flèche haut sur la première carte d'une colonne ne la déplace pas", async () => {
      const onMove = vi.fn();
      render(board(onMove));

      // Géométrie factice : les onglets, masqués, ont le rectangle vide d'un `display: none` en (0, 0), seule
      // cible au-dessus de « d » (DOING).
      await dragWithKeyboard("d", ["ArrowUp"]);

      expect(onMove).not.toHaveBeenCalled();
    });
    it("s'hydrate après un rendu serveur en onglets sans avertissement ni erreur", async () => {
      const error = vi.spyOn(console, "error");
      const warn = vi.spyOn(console, "warn");
      const container = document.createElement("div");
      container.innerHTML = renderToString(board());
      document.body.append(container);

      const root = await act(async () => hydrateRoot(container, board()));

      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(0);
      act(() => root.unmount());
      container.remove();
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
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const container = document.createElement("div");
    container.innerHTML = renderToString(board());
    document.body.append(container);

    const root = await act(async () => hydrateRoot(container, board()));

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  describe("ouverture d'une carte (onOpen)", () => {
    function openable() {
      const onOpen = vi.fn();
      const onMove = vi.fn();
      render(board(onMove, COLUMNS, { onOpen }));
      return { onOpen, onMove, card: cardHandle("b") };
    }

    /** Doigt ou souris posé sur la carte (`pointerType`), au point (100, 100). */
    function down(card: HTMLElement, pointerType: "touch" | "mouse") {
      fireEvent.pointerDown(card, {
        pointerType,
        isPrimary: true,
        button: 0,
        clientX: 100,
        clientY: 100,
      });
    }

    function moveTo(pointerType: "touch" | "mouse", dx: number, dy: number) {
      fireEvent.pointerMove(window, {
        pointerType,
        clientX: 100 + dx,
        clientY: 100 + dy,
      });
    }

    /** Doigt ou souris relevé, puis le `click` que le navigateur émet ensuite. */
    function up(card: HTMLElement, pointerType: "touch" | "mouse") {
      fireEvent.pointerUp(window, { pointerType, button: 0 });
      fireEvent.click(card, { detail: 1 });
    }

    it("un tap court ouvre la carte", () => {
      const { onOpen, card } = openable();

      down(card, "touch");
      moveTo("touch", 3, 3);
      up(card, "touch");

      expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
    });

    it("un clic à la souris ouvre la carte", () => {
      const { onOpen, card } = openable();

      down(card, "mouse");
      up(card, "mouse");

      expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
    });

    it("un glisser à la souris n'ouvre pas la carte, même si un clic suit", () => {
      const { onOpen, card } = openable();

      down(card, "mouse");
      moveTo("mouse", 5, 0);
      up(card, "mouse");

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("un doigt qui bouge au-delà de la tolérance n'ouvre pas la carte", () => {
      const { onOpen, card } = openable();

      down(card, "touch");
      moveTo("touch", 0, 7);
      up(card, "touch");

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("un appui long (250 ms) n'ouvre pas la carte, même si un clic suit", () => {
      vi.useFakeTimers();
      try {
        const { onOpen, card } = openable();

        down(card, "touch");
        act(() => vi.advanceTimersByTime(250));
        up(card, "touch");

        expect(onOpen).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("un appui juste sous 250 ms reste un tap", () => {
      vi.useFakeTimers();
      try {
        const { onOpen, card } = openable();

        down(card, "touch");
        act(() => vi.advanceTimersByTime(249));
        up(card, "touch");

        expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
      } finally {
        vi.useRealTimers();
      }
    });

    it("un défilement pendant le geste n'ouvre pas la carte", () => {
      const { onOpen, card } = openable();

      down(card, "touch");
      fireEvent.scroll(window);
      up(card, "touch");

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("un geste repris par le navigateur (défilement natif, pointercancel) n'ouvre pas la carte", () => {
      const { onOpen, card } = openable();

      down(card, "touch");
      fireEvent.pointerCancel(window, { pointerType: "touch" });
      up(card, "touch");

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("le geste suivant repart de zéro : un tap après un glisser ouvre la carte", () => {
      const { onOpen, card } = openable();
      down(card, "mouse");
      moveTo("mouse", 20, 0);
      up(card, "mouse");

      down(card, "touch");
      up(card, "touch");

      expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
    });

    it("une activation sans pointeur (lecteur d'écran) ouvre la carte", () => {
      const { onOpen, card } = openable();

      fireEvent.click(card, { detail: 0 });

      expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
    });

    it("Entrée ouvre la carte sans la saisir", async () => {
      const { onOpen, card } = openable();
      card.focus();

      await press(card, "Enter");

      expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
      expect(card.getAttribute("aria-pressed")).not.toBe("true");
      expect(document.querySelector("[data-board-overlay]")).toBeNull();
    });

    it("Espace saisit la carte sans l'ouvrir", async () => {
      const { onOpen, card } = openable();
      card.focus();

      await press(card, "Space");

      expect(document.querySelector("[data-board-overlay]")).not.toBeNull();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("pendant une saisie au clavier, Entrée dépose la carte sans l'ouvrir", async () => {
      const { onOpen, onMove } = openable();
      cardHandle("a").focus();
      await press(cardHandle("a"), "Space");
      await press(cardHandle("a"), "ArrowDown");

      await press(cardHandle("a"), "Enter");

      expect(onMove).toHaveBeenCalledOnce();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("sans onOpen, Entrée saisit la carte comme Espace", async () => {
      render(board());
      const card = cardHandle("b");
      card.focus();

      await press(card, "Enter");

      expect(document.querySelector("[data-board-overlay]")).not.toBeNull();
    });

    it.each([
      ["fr", fr.kanban.instructionsOpen],
      ["en", en.kanban.instructionsOpen],
    ] as const)(
      "consignes du lecteur d'écran en %s : Entrée ouvre, Espace saisit",
      (locale, instructions) => {
        render(board(vi.fn(), COLUMNS, { locale, onOpen: vi.fn() }));

        expect(document.body.textContent).toContain(instructions);
      },
    );
  });
});
