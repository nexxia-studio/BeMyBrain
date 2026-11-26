import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { NextIntlClientProvider } from "next-intl";
import { MotionGlobalConfig } from "motion/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";

import {
  type BoardColumn,
  type BoardMove,
  SortableBoard,
} from "./SortableBoard";

type Card = { id: string; title: string };

const reducedMotion = vi.hoisted(() => ({ current: false }));

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => reducedMotion.current,
}));

// Animations Motion jouées d'un coup : l'état final se lit tout de suite.
beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

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
  extra: {
    locale?: "fr" | "en";
    onOpen?: (id: string) => void;
    onCollapsedChange?: (columnId: string, collapsed: boolean) => void;
  } = {},
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
        onCollapsedChange={extra.onCollapsedChange}
      />
    </NextIntlClientProvider>
  );
}

// Largeur simulée : `wide` = au-delà de 768 px (colonnes), sinon onglets. jsdom ne lit pas le CSS de Tailwind :
// `matchMedia` répond selon `wide`, et un élément masqué par la mise en page (`md:hidden` au-delà, `hidden` en
// deçà) reçoit le rectangle vide d'un `display: none`.
let wide = true;
/** Largeur visible de la barre d'onglets (les onglets font 90 px tous les 100 px). */
let tablistWidth = 1000;
/** Hauteur commune des colonnes côte à côte (étirées à la plus haute) ; `null` : chacune à la hauteur de ses cartes. */
let rowHeight: number | null = null;

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
  // Retrait de 4 px de la barre autour des onglets, comme à l'écran.
  if (this.matches('[role="tablist"]')) {
    return rect(-4, -64, tablistWidth + 4, 48);
  }
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  if (tabs.includes(this)) return rect(tabs.indexOf(this) * 100, -60, 90, 40);
  const columnIndex = columns.indexOf(this);
  if (columnIndex >= 0) {
    const count = this.querySelectorAll("[data-board-card]").length;
    return rect(columnIndex * 300, 0, 280, rowHeight ?? 60 + count * 60);
  }
  return rect(0, 0, 0, 0);
}

beforeEach(() => {
  stubWidth(true);
  tablistWidth = 1000;
  rowHeight = null;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    fakeRect,
  );
});

afterEach(() => {
  reducedMotion.current = false;
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

  describe("colonne repliable", () => {
    function foldable(extra: Partial<BoardColumn<Card>> = {}) {
      return [
        column("todo", ["a", "b"]),
        column("canceled", ["x", "y"], {
          collapsible: true,
          collapsed: true,
          ...extra,
        }),
      ];
    }

    const toggle = () =>
      within(columnSection("canceled")).getByRole("button", {
        name: /CANCELED/,
      });
    const classesOf = (element: Element) => element.className.split(/\s+/);

    /** Tableau dont l'appelant tient l'état replié, comme la démo. */
    function Controlled({ onMove }: { onMove?: (move: BoardMove) => void }) {
      const [collapsed, setCollapsed] = useState(true);
      return board(onMove, foldable({ collapsed }), {
        onCollapsedChange: (_id, next) => setCollapsed(next),
      });
    }

    it("repliée, c'est un bandeau étroit : libellé et compteur, pas de cartes, pas la largeur d'une colonne", () => {
      render(board(vi.fn(), foldable()));

      const canceled = within(columnSection("canceled"));
      expect(canceled.getByText("CANCELED")).toBeDefined();
      expect(canceled.getByText("2")).toBeDefined();
      expect(screen.queryByText("x")).toBeNull();
      expect(classesOf(columnSection("canceled"))).toContain("md:w-auto");
      expect(classesOf(columnSection("canceled"))).not.toContain("md:w-80");
      expect(classesOf(columnSection("todo"))).toContain("md:w-80");
    });

    it("le libellé du bandeau reste entier, à l'horizontale", () => {
      render(board(vi.fn(), foldable()));

      const heading = screen.getByRole("heading", { name: /CANCELED/ });

      expect(classesOf(heading)).toContain("md:whitespace-nowrap");
      expect(heading.className).not.toMatch(
        /truncate|line-clamp|rotate|vertical|writing/,
      );
    });

    it("le bouton du bandeau demande à déplier, au clic", () => {
      const onCollapsedChange = vi.fn();
      render(board(vi.fn(), foldable(), { onCollapsedChange }));

      fireEvent.click(toggle());

      expect(onCollapsedChange).toHaveBeenCalledExactlyOnceWith(
        "canceled",
        false,
      );
    });

    it("le bouton de la colonne dépliée demande à replier, au clic", () => {
      const onCollapsedChange = vi.fn();
      render(
        board(vi.fn(), foldable({ collapsed: false }), { onCollapsedChange }),
      );

      fireEvent.click(toggle());

      expect(onCollapsedChange).toHaveBeenCalledExactlyOnceWith(
        "canceled",
        true,
      );
    });

    it("l'appelant tient l'état : le bandeau se déplie en colonne avec ses cartes, puis se replie, le focus reste sur le bouton", () => {
      render(<Controlled />);
      toggle().focus();

      fireEvent.click(toggle());

      expect(screen.getByText("x")).toBeDefined();
      expect(toggle().getAttribute("aria-expanded")).toBe("true");
      expect(classesOf(columnSection("canceled"))).toContain("md:w-80");
      expect(document.activeElement).toBe(toggle());

      fireEvent.click(toggle());

      expect(screen.queryByText("x")).toBeNull();
      expect(toggle().getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(toggle());
    });

    it("sans onCollapsedChange, le bouton ne change rien et ne lève rien", () => {
      render(board(vi.fn(), foldable()));

      fireEvent.click(toggle());

      expect(screen.queryByText("x")).toBeNull();
    });

    it("le bouton est un vrai bouton (Entrée et Espace l'activent), relié à la zone qu'il déplie", () => {
      render(board(vi.fn(), foldable()));

      const button = toggle();

      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(
        document.getElementById(button.getAttribute("aria-controls")!),
      ).not.toBeNull();
      expect(
        columnSection("canceled").contains(
          document.getElementById(button.getAttribute("aria-controls")!),
        ),
      ).toBe(true);
    });

    it("zone du bouton de 44 px, étendue à tout le bandeau quand il est replié", () => {
      render(<Controlled />);

      expect(classesOf(toggle())).toEqual(
        expect.arrayContaining([
          "size-11",
          "md:after:absolute",
          "md:after:inset-0",
        ]),
      );

      fireEvent.click(toggle());

      expect(classesOf(toggle())).toContain("size-11");
      expect(toggle().className).not.toContain("after:");
    });

    it("le bouton n'est pas une carte déplaçable : ni Espace ni Entrée dessus ne saisissent quoi que ce soit", async () => {
      render(board(vi.fn(), foldable()));
      toggle().focus();

      await press(toggle(), "Space");
      await press(toggle(), "Enter");

      expect(toggle().closest("[data-board-card]")).toBeNull();
      expect(toggle().hasAttribute("aria-roledescription")).toBe(false);
      expect(document.querySelector("[data-board-overlay]")).toBeNull();
    });

    it.each([
      ["fr", true, "CANCELED, 2 cartes, déplier"],
      ["fr", false, "CANCELED, 2 cartes, replier"],
      ["en", true, "CANCELED, 2 cards, expand"],
      ["en", false, "CANCELED, 2 cards, collapse"],
    ] as const)(
      "nom accessible du bouton en %s (repliée : %s) : libellé, compteur, action",
      (locale, collapsed, name) => {
        render(board(vi.fn(), foldable({ collapsed }), { locale }));

        expect(
          within(columnSection("canceled")).getByRole("button", { name }),
        ).toBeDefined();
      },
    );

    it.each([
      ["fr", 0, "CANCELED, aucune carte, déplier"],
      ["fr", 1, "CANCELED, 1 carte, déplier"],
      ["en", 0, "CANCELED, no cards, expand"],
      ["en", 1, "CANCELED, 1 card, expand"],
    ] as const)(
      "nom accessible en %s pour %i carte : pluriel accordé",
      (locale, count, name) => {
        const columns = [
          column("todo", ["a"]),
          column("canceled", ["x", "y"].slice(0, count), {
            collapsible: true,
            collapsed: true,
          }),
        ];

        render(board(vi.fn(), columns, { locale }));

        expect(screen.getByRole("button", { name })).toBeDefined();
      },
    );

    it("le nom du bouton compte le total de la colonne, pas les seules cartes affichées", () => {
      render(board(vi.fn(), foldable({ total: 25 })));

      expect(
        screen.getByRole("button", { name: "CANCELED, 25 cartes, déplier" }),
      ).toBeDefined();
    });

    it("une carte déposée sur le bandeau replié passe en tête de la colonne", async () => {
      const onMove = vi.fn();
      render(board(onMove, foldable()));

      await dragWithKeyboard("a", ["ArrowRight"]);

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "canceled",
        beforeId: null,
        afterId: "x",
      });
    });

    it("le bandeau visé est cerné pendant le glisser", async () => {
      render(board(vi.fn(), foldable()));
      cardHandle("a").focus();
      await press(cardHandle("a"), "Space");

      await press(cardHandle("a"), "ArrowRight");

      expect(classesOf(columnSection("canceled"))).toEqual(
        expect.arrayContaining(["outline-2", "outline-ring"]),
      );
    });

    it("une carte déposée dans la colonne dépliée prend place parmi ses cartes", async () => {
      const onMove = vi.fn();
      render(board(onMove, foldable({ collapsed: false })));

      // Géométrie factice : « y », à la hauteur de « b », est la carte la plus proche à droite.
      await dragWithKeyboard("b", ["ArrowRight"]);

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "b",
        toColumn: "canceled",
        beforeId: "x",
        afterId: "y",
      });
    });

    it("dépliée puis repliée par l'appelant, la colonne reçoit de nouveau les cartes en tête", async () => {
      const onMove = vi.fn();
      render(<Controlled onMove={onMove} />);
      fireEvent.click(toggle());
      fireEvent.click(toggle());

      await dragWithKeyboard("a", ["ArrowRight"]);

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "canceled",
        beforeId: null,
        afterId: "x",
      });
    });

    it("dépliée, la colonne montre son pied sous ses cartes ; repliée, non", () => {
      const footer = <button>PIED</button>;
      const { rerender } = render(
        board(vi.fn(), foldable({ collapsed: false, footer })),
      );

      expect(screen.getByRole("button", { name: "PIED" })).toBeDefined();

      rerender(board(vi.fn(), foldable({ collapsed: true, footer })));

      expect(screen.queryByRole("button", { name: "PIED" })).toBeNull();
    });

    it("une colonne non repliable n'a pas de bouton et ignore `collapsed` : colonne normale", () => {
      const columns = [
        column("todo", ["a"]),
        column("canceled", ["x"], { collapsed: true }),
      ];

      render(board(vi.fn(), columns));

      expect(screen.getByText("x")).toBeDefined();
      expect(
        within(columnSection("canceled")).queryByRole("button", {
          name: /CANCELED/,
        }),
      ).toBeNull();
      expect(classesOf(columnSection("canceled"))).toContain("md:w-80");
    });

    describe("sous 768 px", () => {
      beforeEach(() => {
        stubWidth(false);
      });

      it("la colonne repliée est le panneau de son onglet comme les autres, cartes visibles", () => {
        render(board(vi.fn(), foldable()));
        fireEvent.click(screen.getByRole("tab", { name: /CANCELED/ }));

        expect(shownWhenNarrow("canceled")).toBe(true);
        expect(columnSection("canceled").getAttribute("role")).toBe("tabpanel");
        expect(screen.getByText("x")).toBeDefined();
        expect(screen.getByText("y")).toBeDefined();
      });

      it("le bouton pour déplier est masqué avec l'en-tête, et rien du bandeau ne s'applique", () => {
        render(board(vi.fn(), foldable()));

        const header = columnSection("canceled").querySelector(
          "[data-board-header]",
        )!;

        expect(header.contains(toggle())).toBe(true);
        expect(classesOf(header)).toEqual(
          expect.arrayContaining(["hidden", "md:flex"]),
        );
        // Tout ce qui fait le bandeau est réservé à 768 px et plus.
        const band = [columnSection("canceled"), header, toggle()].flatMap(
          (element) =>
            classesOf(element).filter((name) =>
              /w-auto|relative|flex-col-reverse|after:|whitespace/.test(name),
            ),
        );
        expect(band.filter((name) => !name.startsWith("md:"))).toEqual([]);
      });

      it("une carte déposée dans le panneau d'une colonne repliable y prend place normalement", async () => {
        const onMove = vi.fn();
        render(board(onMove, foldable()));
        fireEvent.click(screen.getByRole("tab", { name: /CANCELED/ }));

        await dragWithKeyboard("x", ["ArrowDown"]);

        expect(onMove).toHaveBeenCalledExactlyOnceWith({
          id: "x",
          toColumn: "canceled",
          beforeId: "y",
          afterId: null,
        });
      });
    });

    it("rendu serveur d'une colonne repliée puis hydratation à 768 px et plus : ni avertissement ni erreur, cartes masquées avant, absentes après", async () => {
      const error = vi.spyOn(console, "error");
      const warn = vi.spyOn(console, "warn");
      const container = document.createElement("div");
      container.innerHTML = renderToString(board(vi.fn(), foldable()));
      document.body.append(container);
      // Avant l'hydratation, le serveur a rendu les cartes (panneau d'onglet) : le CSS seul les masque.
      const serverCards = container.querySelector('[data-board-card="x"]');
      const hiddenByCss = serverCards
        ?.closest('[data-board-column="canceled"] > div')
        ?.className.split(/\s+/)
        .includes("md:hidden");

      const root = await act(async () =>
        hydrateRoot(container, board(vi.fn(), foldable())),
      );

      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(serverCards).not.toBeNull();
      expect(hiddenByCss).toBe(true);
      expect(container.querySelector('[data-board-card="x"]')).toBeNull();
      act(() => root.unmount());
      container.remove();
    });
  });

  // Colonnes côte à côte étirées à la plus haute (1 300 px). Géométrie factice : colonnes de 280 px tous les
  // 300 px, cartes de 260 × 50 px tous les 60 px. La souris saisit « a » en son centre (140, 75).
  describe("dépôt à la souris dans la colonne sous le pointeur", () => {
    const MANY = ["a", "b", "c", "e", "f", "g", "h", "i", "j", "k", "l", "m"];

    async function mouse(
      type: "mouseDown" | "mouseMove" | "mouseUp",
      target: Element | Document,
      x: number,
      y: number,
    ) {
      await act(async () => {
        fireEvent[type](target, { button: 0, clientX: x, clientY: y });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }

    async function dragWithMouse(title: string, to: { x: number; y: number }) {
      await mouse("mouseDown", cardHandle(title), 140, 75);
      await mouse("mouseMove", document, 150, 75);
      await mouse("mouseMove", document, to.x - 5, to.y);
      await mouse("mouseMove", document, to.x, to.y);
      await mouse("mouseUp", document, to.x, to.y);
      // dnd-kit avale tout clic dans les 50 ms qui suivent un glisser à la souris : on les laisse passer, sinon
      // le premier clic du test suivant serait perdu.
      await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
    }

    beforeEach(() => {
      rowHeight = 1300;
    });

    it("au milieu d'une colonne vide et haute, la carte y arrive, pas chez une voisine dont les cartes sont plus proches", async () => {
      const onMove = vi.fn();
      const columns = [
        column("todo", MANY),
        column("doing", []),
        column("done", ["x"]),
      ];
      render(board(onMove, columns));

      await dragWithMouse("a", { x: 440, y: 650 });

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "doing",
        beforeId: null,
        afterId: null,
      });
    });

    it("en haut d'une colonne vide et haute, la carte y arrive, pas dans la colonne suivante", async () => {
      const onMove = vi.fn();
      const columns = [
        column("todo", MANY),
        column("doing", []),
        column("done", ["x", "y"]),
      ];
      render(board(onMove, columns));

      await dragWithMouse("a", { x: 440, y: 80 });

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "doing",
        beforeId: null,
        afterId: null,
      });
    });

    it("loin sous la dernière carte d'une colonne courte, à côté d'une colonne longue, la carte arrive en fin de la colonne courte", async () => {
      const onMove = vi.fn();
      const columns = [column("todo", MANY), column("doing", ["d"])];
      render(board(onMove, columns));

      await dragWithMouse("a", { x: 440, y: 650 });

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "doing",
        beforeId: "d",
        afterId: null,
      });
    });

    it("hors de toute colonne (entre deux colonnes), la cible reste la plus proche par ses coins, comme avant", async () => {
      const onMove = vi.fn();
      const columns = [column("todo", MANY), column("doing", ["d"])];
      render(board(onMove, columns));

      // x = 290 : dans l'écart entre « todo » (0 à 280) et « doing » (300 à 580), à la hauteur de « k ».
      await dragWithMouse("a", { x: 290, y: 650 });

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "todo",
        beforeId: "l",
        afterId: "m",
      });
    });

    it("sous le tableau, hors de toute colonne, la cible reste la plus proche par ses coins, comme avant", async () => {
      const onMove = vi.fn();
      const columns = [column("todo", ["a", "b"]), column("doing", ["d"])];
      render(board(onMove, columns));

      await dragWithMouse("a", { x: 440, y: 1400 });

      expect(onMove).toHaveBeenCalledExactlyOnceWith({
        id: "a",
        toColumn: "todo",
        beforeId: "b",
        afterId: null,
      });
    });
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

    describe("cible de dépôt pendant un glisser", () => {
      const tab = (name: RegExp) => screen.getByRole("tab", { name });
      const marker = () => document.querySelector("[data-board-drop-marker]");

      // Géométrie factice : l'onglet DOING est le plus proche au-dessus de « a ».
      async function carryOverDoingTab() {
        cardHandle("a").focus();
        await press(cardHandle("a"), "Space");
        await press(cardHandle("a"), "ArrowUp");
      }

      it("l'onglet visé prend l'état actif complet pendant le glisser, plus après le dépôt", async () => {
        render(board(vi.fn(), COLUMNS));

        await carryOverDoingTab();

        expect(tab(/DOING/).getAttribute("data-drop-target")).toBe("true");
        expect(tab(/DOING/).className.split(/\s+/)).toEqual(
          expect.arrayContaining([
            "bg-pill-active",
            "text-foreground",
            "shadow-raised",
          ]),
        );
        expect(tab(/TODO/).hasAttribute("data-drop-target")).toBe(false);

        await press(cardHandle("a"), "Space");

        expect(document.querySelectorAll("[data-drop-target]")).toHaveLength(0);
        expect(tab(/DOING/).className.split(/\s+/)).not.toContain(
          "bg-pill-active",
        );
      });

      it("l'onglet visé n'est plus marqué après une annulation par Échap", async () => {
        render(board(vi.fn(), COLUMNS));
        await carryOverDoingTab();

        await press(cardHandle("a"), "Escape");

        expect(document.querySelectorAll("[data-drop-target]")).toHaveLength(0);
      });

      it("un repère accroché à la carte portée redit le libellé et le compteur de l'onglet visé, hors du lecteur d'écran", async () => {
        render(board(vi.fn(), COLUMNS));

        await carryOverDoingTab();

        expect(marker()?.textContent).toBe("DOING2");
        expect(marker()?.getAttribute("aria-hidden")).toBe("true");
        // Hors de la copie inclinée : le repère reste droit.
        expect(marker()?.closest("[data-board-overlay]")).toBeNull();

        await press(cardHandle("a"), "Space");

        expect(marker()).toBeNull();
      });

      it.each([
        ["au-dessus de la carte portée quand la place existe", 200, null],
        [
          "sous la carte portée quand elle touche le haut de l'écran",
          10,
          "below",
        ],
      ])("le repère est %s", async (_name, top, side) => {
        render(board(vi.fn(), COLUMNS));
        cardHandle("a").focus();
        await press(cardHandle("a"), "Space");
        // Copie portée : l'enveloppe du calque du glisser, à `top` px du haut de l'écran.
        const carried = document.querySelector(
          "[data-board-overlay]",
        )!.parentElement!;
        Object.defineProperty(carried, "getBoundingClientRect", {
          value: () => ({ top }) as DOMRect,
        });

        await press(cardHandle("a"), "ArrowUp");

        expect(marker()).not.toBeNull();
        expect(marker()!.getAttribute("data-side")).toBe(side);
      });

      // dnd-kit mesure le premier enfant du calque quand il est seul (la carte inclinée), sinon son enveloppe :
      // le repère ne doit exister ni au montage du calque ni au dépôt, instants de cette mesure.
      it("le repère est absent du DOM au montage du calque du glisser : la carte portée y est seule", async () => {
        render(board(vi.fn(), COLUMNS));
        cardHandle("a").focus();

        await press(cardHandle("a"), "Space");

        const carried = document.querySelector("[data-board-overlay]")!;
        expect(marker()).toBeNull();
        expect([...carried.parentElement!.children]).toEqual([carried]);
      });

      it("le repère est absent du DOM dès le dépôt sur un onglet, à chaque état rendu ensuite", async () => {
        render(board(vi.fn(), COLUMNS));
        await carryOverDoingTab();
        expect(marker()).not.toBeNull();
        // Chaque rendu qui suit le dépôt (calque encore monté pour son animation, puis retiré).
        const afterDrop: boolean[] = [];
        const observer = new MutationObserver(() => {
          afterDrop.push(marker() !== null);
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });

        await press(cardHandle("a"), "Space");
        observer.disconnect();

        expect(afterDrop.length).toBeGreaterThan(0);
        expect(afterDrop).not.toContain(true);
        expect(marker()).toBeNull();
      });

      it("aucun repère tant que la carte portée ne vise pas un onglet", async () => {
        render(board(vi.fn(), COLUMNS));
        cardHandle("a").focus();

        await press(cardHandle("a"), "Space");
        await press(cardHandle("a"), "ArrowDown");

        expect(marker()).toBeNull();
        expect(document.querySelectorAll("[data-drop-target]")).toHaveLength(0);
      });

      it("un onglet visé coupé par le bord de la barre y est ramené en entier, par le défilement de la barre seule", async () => {
        // Barre de 150 px : DOING (100 à 190 px) dépasse de 40 px à droite.
        tablistWidth = 150;
        render(board(vi.fn(), COLUMNS));
        const scrollBy = vi.fn();
        Object.defineProperty(screen.getByRole("tablist"), "scrollBy", {
          value: scrollBy,
        });
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;

        await carryOverDoingTab();

        // 40 px de dépassement et 4 px de marge (retrait de la barre).
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({
          left: 44,
          behavior: "smooth",
        });
        expect(scrollIntoView).not.toHaveBeenCalled();
      });

      it("tant qu'il reste des onglets après lui, l'onglet visé s'arrête avant l'amorce : marge du fondu et du bord ombré", async () => {
        tablistWidth = 150;
        render(board(vi.fn(), COLUMNS));
        const bar = screen.getByRole("tablist");
        const scrollBy = vi.fn();
        // La barre déborde encore à droite : amorce affichée de ce côté.
        Object.defineProperties(bar, {
          scrollBy: { value: scrollBy },
          scrollWidth: { value: 400 },
          clientWidth: { value: 154 },
          scrollLeft: { value: 0 },
        });

        await carryOverDoingTab();

        // 40 px de dépassement, 32 px d'amorce (bord ombré, plus large que le fondu de 10 %) et 4 px de marge.
        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({
          left: 76,
          behavior: "smooth",
        });
      });

      it("un onglet choisi au toucher, coupé par le bord de la barre, y est ramené en entier", () => {
        tablistWidth = 150;
        render(board(vi.fn(), COLUMNS));
        const scrollBy = vi.fn();
        Object.defineProperty(screen.getByRole("tablist"), "scrollBy", {
          value: scrollBy,
        });

        fireEvent.click(tab(/DOING/));

        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({
          left: 44,
          behavior: "smooth",
        });
      });

      it("en mouvement réduit, la barre amène l'onglet visé sans animation", async () => {
        reducedMotion.current = true;
        tablistWidth = 150;
        render(board(vi.fn(), COLUMNS));
        const scrollBy = vi.fn();
        Object.defineProperty(screen.getByRole("tablist"), "scrollBy", {
          value: scrollBy,
        });

        await carryOverDoingTab();

        expect(scrollBy).toHaveBeenCalledExactlyOnceWith({
          left: 44,
          behavior: "auto",
        });
      });

      it("un onglet visé entier dans la barre ne la fait pas défiler", async () => {
        render(board(vi.fn(), COLUMNS));
        const scrollBy = vi.fn();
        Object.defineProperty(screen.getByRole("tablist"), "scrollBy", {
          value: scrollBy,
        });

        await carryOverDoingTab();

        expect(scrollBy).not.toHaveBeenCalled();
      });
    });

    describe("amorce de la barre d'onglets", () => {
      function scrollTabsTo(scrollLeft: number) {
        const bar = screen.getByRole("tablist");
        Object.defineProperties(bar, {
          scrollWidth: { value: 500, configurable: true },
          clientWidth: { value: 300, configurable: true },
          scrollLeft: { value: scrollLeft, configurable: true },
        });
        fireEvent.scroll(bar);
        return [
          bar.hasAttribute("data-more-start"),
          bar.hasAttribute("data-more-end"),
        ];
      }

      it("sans débordement, aucune amorce", () => {
        render(board(vi.fn(), COLUMNS));

        const bar = screen.getByRole("tablist");

        expect(bar.hasAttribute("data-more-start")).toBe(false);
        expect(bar.hasAttribute("data-more-end")).toBe(false);
      });

      it("au début d'une barre qui déborde, amorce à droite seulement", () => {
        render(board(vi.fn(), COLUMNS));

        expect(scrollTabsTo(0)).toEqual([false, true]);
      });

      it("au milieu, amorce des deux côtés", () => {
        render(board(vi.fn(), COLUMNS));

        expect(scrollTabsTo(100)).toEqual([true, true]);
      });

      it("en butée, amorce à gauche seulement", () => {
        render(board(vi.fn(), COLUMNS));

        expect(scrollTabsTo(200)).toEqual([true, false]);
      });

      it("l'amorce est un fondu des onglets et un bord ombré, du côté où des onglets restent hors champ", () => {
        render(board(vi.fn(), COLUMNS));

        const bar = screen.getByRole("tablist");
        const edge = (side: string) =>
          bar.parentElement!.querySelector(`[data-board-tabs-more="${side}"]`)!;

        expect(bar.className.split(/\s+/)).toEqual(
          expect.arrayContaining([
            "peer",
            "data-more-start:mask-l-from-90%",
            "data-more-end:mask-r-from-90%",
          ]),
        );
        // Bords ombrés : masqués tant que la barre ne signale rien de ce côté, jamais lus ni touchés.
        expect(edge("start").className.split(/\s+/)).toEqual(
          expect.arrayContaining([
            "hidden",
            "peer-data-more-start:block",
            "pointer-events-none",
          ]),
        );
        expect(edge("end").className.split(/\s+/)).toEqual(
          expect.arrayContaining([
            "hidden",
            "peer-data-more-end:block",
            "pointer-events-none",
          ]),
        );
        expect(edge("end").getAttribute("aria-hidden")).toBe("true");
      });
    });

    it("l'en-tête de colonne n'est pas répété sous l'onglet : masqué sous 768 px, le panneau est nommé par son onglet", () => {
      render(board(vi.fn(), COLUMNS));

      const header = columnSection("todo").querySelector(
        "[data-board-header]",
      )!;

      expect(header.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["hidden", "md:flex"]),
      );
      expect(columnSection("todo").getAttribute("aria-labelledby")).toBe(
        screen.getByRole("tab", { name: /TODO/ }).id,
      );
      expect(screen.getByRole("tabpanel", { name: "TODO3" })).toBe(
        columnSection("todo"),
      );
    });
  });

  describe("au-delà de 768 px, en colonnes", () => {
    it("aucune colonne n'est un panneau d'onglet", () => {
      render(board());

      expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(0);
    });

    it("chaque colonne est nommée par son en-tête, visible", () => {
      render(board());

      const heading = screen.getByRole("heading", { name: /TODO/ });

      expect(columnSection("todo").getAttribute("aria-labelledby")).toBe(
        heading.id,
      );
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
      const view = render(board(onMove, COLUMNS, { onOpen }));
      return { onOpen, onMove, card: cardHandle("b"), unmount: view.unmount };
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

    it("le défilement d'un conteneur (colonne, tableau) pendant le geste n'ouvre pas la carte", () => {
      const { onOpen, card } = openable();

      down(card, "touch");
      // `scroll` ne remonte pas : seule une écoute en capture sur `window` le voit.
      fireEvent.scroll(columnSection("todo"));
      up(card, "touch");

      expect(onOpen).not.toHaveBeenCalled();
    });

    it("au démontage pendant un geste, retire ses écouteurs de window", () => {
      const { card, unmount } = openable();
      down(card, "touch");
      const remove = vi.spyOn(window, "removeEventListener");

      unmount();

      const removed = remove.mock.calls.map(([type]) => type);
      expect(removed).toEqual(
        expect.arrayContaining([
          "pointermove",
          "pointercancel",
          "pointerup",
          "scroll",
        ]),
      );
      expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function), true);
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

    it("pendant une saisie au clavier, Tab dépose la carte", async () => {
      const { onOpen, onMove } = openable();
      cardHandle("a").focus();
      await press(cardHandle("a"), "Space");
      await press(cardHandle("a"), "ArrowDown");

      await press(cardHandle("a"), "Tab");

      expect(onMove).toHaveBeenCalledOnce();
      expect(document.querySelector("[data-board-overlay]")).toBeNull();
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

  describe("saisie : copie soulevée et empreinte", () => {
    function overlay() {
      return document.querySelector("[data-board-overlay]") as HTMLElement;
    }

    async function pickWithKeyboard(id: string) {
      render(board());
      cardHandle(id).focus();
      await press(cardHandle(id), "Space");
    }

    it("la copie qui suit le pointeur est inclinée et soulevée", async () => {
      await pickWithKeyboard("a");

      // Motion pose la valeur finale à la frame suivante, même animations coupées.
      await vi.waitFor(() => {
        expect(overlay().style.transform).toContain("rotate(2deg)");
        expect(overlay().style.transform).toContain("translateY(-2px)");
      });
    });

    it("en mouvement réduit, la copie n'est ni inclinée ni soulevée", async () => {
      reducedMotion.current = true;
      await pickWithKeyboard("a");
      // Deux frames : le temps que Motion aurait posé une inclinaison.
      for (let frame = 0; frame < 2; frame++) {
        await act(
          () => new Promise((resolve) => requestAnimationFrame(resolve)),
        );
      }

      expect(overlay()).not.toBeNull();
      expect(overlay().style.transform).not.toContain("rotate");
      expect(overlay().style.transform).not.toContain("translateY");
    });

    function footprints() {
      return document.querySelectorAll('[data-testid="board-footprint"]');
    }

    it("une empreinte en pointillé reste à la place d'origine pendant un glisser au clavier", async () => {
      await pickWithKeyboard("b");
      await press(cardHandle("b"), "ArrowDown");

      expect(footprints()).toHaveLength(1);
      expect(
        footprints()[0]
          .closest("[data-board-card]")
          ?.getAttribute("data-board-card"),
      ).toBe("b");
      expect(footprints()[0].className).toContain("outline-dashed");
    });

    it("l'empreinte a un fond plus clair que la colonne et un pointillé de 2 px à l'encre secondaire, dessiné vers l'intérieur", async () => {
      await pickWithKeyboard("b");

      const classes = footprints()[0].className.split(/\s+/);
      expect(classes).toEqual(
        expect.arrayContaining([
          "bg-row",
          "outline-2",
          "outline-dashed",
          "-outline-offset-2",
          "outline-input",
        ]),
      );
      expect(classes).not.toContain("bg-pill-track");
      // L'indigo reste à l'anneau de focus et à la cible de dépôt.
      expect(classes).not.toContain("outline-ring");
    });

    it("la carte saisie au clavier garde le focus et son anneau : le pointillé est sur un enfant", async () => {
      await pickWithKeyboard("b");
      await press(cardHandle("b"), "ArrowDown");

      expect(document.activeElement).toBe(cardHandle("b"));
      expect(document.activeElement?.className).not.toContain("outline");
      expect(document.activeElement?.contains(footprints()[0])).toBe(true);
    });

    it("pendant la saisie, la carte garde son nom pour le lecteur d'écran", async () => {
      await pickWithKeyboard("b");
      await press(cardHandle("b"), "ArrowDown");

      expect(screen.getByRole("button", { name: "b" })).toBe(cardHandle("b"));
    });

    it("l'empreinte disparaît au dépôt", async () => {
      await pickWithKeyboard("b");
      await press(cardHandle("b"), "ArrowDown");
      await press(cardHandle("b"), "Space");

      expect(footprints()).toHaveLength(0);
    });
  });
});

describe("surfaces du tableau (Creux)", () => {
  const classesOf = (element: Element) => element.className.split(/\s+/);
  const heading = (id: string) => columnSection(id).querySelector("h2")!;

  it("colonne creusée posée à nu : fond pill-track, sans verre ni ombre", () => {
    render(board());

    const section = classesOf(columnSection("todo"));
    expect(section).toContain("bg-pill-track");
    expect(section).not.toContain("glass");
    expect(section.filter((name) => name.includes("shadow"))).toEqual([]);
    expect(section).toEqual(
      expect.arrayContaining(["flex", "flex-col", "rounded-tile", "p-tile"]),
    );
  });

  it("en-tête de colonne à l'encre, jamais en texte secondaire", () => {
    render(board());

    expect(classesOf(heading("todo"))).toContain("text-foreground");
    expect(classesOf(heading("todo"))).not.toContain("text-muted-foreground");
    expect(classesOf(heading("todo"))).toContain("text-eyebrow");
  });

  it("aucun creux intérieur sous les cartes", () => {
    render(board());

    const cards = columnSection("todo").querySelector("[data-board-cards]")!;
    expect(cards.className).not.toMatch(/\bbg-|\bp-\d/);
    expect(cards.querySelectorAll("[data-board-card]")).toHaveLength(3);
  });
});

describe("survol d'une carte", () => {
  const SURFACE_CLASSES = [
    "pointer-fine:group-hover/card:shadow-glass",
    "pointer-fine:group-hover/card:outline",
    "pointer-fine:group-hover/card:-outline-offset-1",
    "pointer-fine:group-hover/card:outline-input",
  ];
  // Montée de 2 px en CSS : même course et même durée que le survol d'une tuile, jamais en mouvement réduit.
  const LIFT_CLASSES = [
    "motion-safe:pointer-fine:group-hover/card:-translate-y-0.5",
    "motion-safe:transition-transform",
    "motion-safe:duration-300",
    "motion-safe:ease-out-expo",
  ];
  const classesOf = (element: Element) => element.className.split(/\s+/);

  function lift(id: string) {
    return cardHandle(id).querySelector("[data-board-lift]") as HTMLElement;
  }

  function hoverZone(id: string) {
    return lift(id).parentElement as HTMLElement;
  }

  // Événement qu'écouterait une bibliothèque d'animation posée sur la zone (il ne remonte pas).
  async function enter(id: string) {
    const event = new MouseEvent("pointerenter");
    Object.defineProperty(event, "pointerType", { value: "mouse" });
    await act(async () => {
      hoverZone(id).dispatchEvent(event);
      for (let frame = 0; frame < 2; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
  }

  function expectNoScriptedMotion(id: string) {
    expect(lift(id).getAttribute("style")).toBeNull();
    expect(hoverZone(id).getAttribute("style")).toBeNull();
  }

  it("au repos, la carte porte contour et ombre de survol réservés au pointeur fin", () => {
    render(board());

    expect(classesOf(lift("a"))).toEqual(
      expect.arrayContaining(SURFACE_CLASSES),
    );
    expect(classesOf(hoverZone("a"))).toContain("group/card");
  });

  it("le contour et l'ombre ne sont posés ni sur le nœud mesuré par le glisser ni hors pointeur fin", () => {
    render(board());

    expect(cardHandle("a").className).not.toMatch(/shadow|outline|translate/);
    expect(
      classesOf(lift("a")).filter(
        (name) =>
          /shadow|outline/.test(name) && !name.startsWith("pointer-fine:"),
      ),
    ).toEqual([]);
  });

  it("au survol, la carte monte de 2 px par une transition CSS de 0,3 s, sur l'enfant de la zone survolée", () => {
    render(board());

    expect(classesOf(lift("a"))).toEqual(expect.arrayContaining(LIFT_CLASSES));
    expect(hoverZone("a").parentElement).toBe(cardHandle("a"));
    expect(hoverZone("a").className).not.toMatch(/translate|transition/);
  });

  it("la montée est réservée au pointeur fin et coupée en mouvement réduit", () => {
    render(board());

    const moving = classesOf(lift("a")).filter((name) =>
      /translate|transition|duration|ease/.test(name),
    );
    expect(moving).toHaveLength(LIFT_CLASSES.length);
    expect(moving.filter((name) => !name.startsWith("motion-safe:"))).toEqual(
      [],
    );
    expect(moving.filter((name) => name.includes("translate"))).toEqual([
      "motion-safe:pointer-fine:group-hover/card:-translate-y-0.5",
    ]);
  });

  it("aucun composant d'animation dans une carte : le survol ne pose aucun style en ligne", async () => {
    render(board());

    await enter("a");

    expectNoScriptedMotion("a");
  });

  it("pendant un glisser, aucune carte n'a de survol : ni classes ni translation", async () => {
    render(board());
    cardHandle("a").focus();
    await press(cardHandle("a"), "Space");

    await enter("b");

    for (const id of ["a", "b", "d"]) {
      expect(
        classesOf(lift(id)).filter((name) => name.includes("group-hover")),
      ).toEqual([]);
    }
    expectNoScriptedMotion("b");
  });

  it("après un survol, un glisser et un dépôt, la carte n'a aucun style en ligne et retrouve ses classes de repos", async () => {
    render(board());
    await enter("a");

    await dragWithKeyboard("a", ["ArrowDown"]);

    expectNoScriptedMotion("a");
    expect(classesOf(lift("a"))).toEqual(
      expect.arrayContaining([...SURFACE_CLASSES, ...LIFT_CLASSES]),
    );
  });

  it("après un survol, une saisie et un relâchement par Échap, la carte n'a aucun style en ligne et retrouve ses classes de repos", async () => {
    render(board());
    await enter("a");
    cardHandle("a").focus();
    await press(cardHandle("a"), "Space");

    await press(cardHandle("a"), "Escape");

    expectNoScriptedMotion("a");
    expect(classesOf(lift("a"))).toEqual(
      expect.arrayContaining([...SURFACE_CLASSES, ...LIFT_CLASSES]),
    );
  });

  it("pendant la saisie, le contenu de la carte saisie est transparent, sans autre style", async () => {
    render(board());
    cardHandle("a").focus();

    await press(cardHandle("a"), "Space");

    expect(classesOf(lift("a"))).toContain("opacity-0");
    expect(classesOf(lift("b"))).not.toContain("opacity-0");
  });
});
