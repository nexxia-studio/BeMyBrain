import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import {
  type BoardColumn,
  SortableBoard,
} from "@/components/kanban/SortableBoard";

import fr from "../../../messages/fr.json";
import {
  BOARD_CARDS_CLASSES,
  BOARD_COLUMN_CLASSES,
  BOARD_COLUMN_FOLDED_CLASSES,
  BOARD_COLUMN_OPEN_CLASSES,
  BOARD_COLUMN_UNCHOSEN_CLASSES,
  BOARD_COLUMNS_CLASSES,
  BOARD_HEADER_CLASSES,
  BOARD_HEADER_FOLDED_CLASSES,
  BOARD_HEADING_CLASSES,
  BOARD_HEADING_FOLDED_CLASSES,
  BOARD_TAB_HEIGHT,
  BOARD_TABLIST_CLASSES,
  BOARD_TABS_CLASSES,
  BOARD_TOGGLE_CLASSES,
} from "./task-board-layout";

// Le givre du tableau recopie les classes de place et de taille de `SortableBoard` (fichier figé, qui ne les
// exporte pas). Ce verrou les compare au vrai tableau : une classe changée là-bas fait échouer ici.

type Card = { id: string };

const COLUMNS: BoardColumn<Card>[] = [
  { id: "open", label: "Ouverte", items: [{ id: "a" }] },
  { id: "other", label: "Autre", items: [] },
  {
    id: "folded",
    label: "Repliée",
    items: [],
    collapsible: true,
    collapsed: true,
  },
];

function expectClasses(element: Element | null, classes: string) {
  expect(element?.className.split(/\s+/)).toEqual(
    expect.arrayContaining(classes.split(" ")),
  );
}

function renderBoard() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  return render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <SortableBoard
        columns={COLUMNS}
        getItemLabel={(card) => card.id}
        renderCard={(card) => <span>{card.id}</span>}
        onMove={() => {}}
        onCollapsedChange={() => {}}
      />
    </NextIntlClientProvider>,
  ).container;
}

describe("géométrie du tableau recopiée pour le givre", () => {
  it("barre d'onglets : enveloppe, barre et hauteur d'un onglet", () => {
    const container = renderBoard();

    const tablist = container.querySelector('[role="tablist"]')!;
    expectClasses(tablist.parentElement, BOARD_TABS_CLASSES);
    expectClasses(tablist, BOARD_TABLIST_CLASSES);
    expectClasses(tablist.querySelector('[role="tab"]'), BOARD_TAB_HEIGHT);
  });

  it("colonnes : rangée, colonne ouverte, colonne d'un autre onglet, en-tête, titre, cartes", () => {
    const container = renderBoard();

    const open = container.querySelector('[data-board-column="open"]')!;
    const other = container.querySelector('[data-board-column="other"]')!;
    expectClasses(open.parentElement, BOARD_COLUMNS_CLASSES);
    expectClasses(open, `${BOARD_COLUMN_CLASSES} ${BOARD_COLUMN_OPEN_CLASSES}`);
    expectClasses(other, BOARD_COLUMN_UNCHOSEN_CLASSES);
    const header = open.querySelector("[data-board-header]")!;
    expectClasses(header, BOARD_HEADER_CLASSES);
    expectClasses(header.querySelector("h2"), BOARD_HEADING_CLASSES);
    expectClasses(
      open.querySelector("[data-board-cards]"),
      BOARD_CARDS_CLASSES,
    );
  });

  it("bandeau replié : colonne, en-tête, titre et bouton", () => {
    const container = renderBoard();

    const folded = container.querySelector('[data-board-column="folded"]')!;
    // Colonne d'un autre onglet : `hidden md:flex` y remplace `flex` (fusion des classes, comme dans le givre).
    expectClasses(
      folded,
      `${BOARD_COLUMN_FOLDED_CLASSES} ${BOARD_COLUMN_UNCHOSEN_CLASSES}`,
    );
    const header = folded.querySelector("[data-board-header]")!;
    expectClasses(
      header,
      `${BOARD_HEADER_CLASSES} ${BOARD_HEADER_FOLDED_CLASSES}`,
    );
    expectClasses(
      header.querySelector("h2"),
      `${BOARD_HEADING_CLASSES} ${BOARD_HEADING_FOLDED_CLASSES}`,
    );
    expectClasses(header.querySelector("button"), BOARD_TOGGLE_CLASSES);
  });
});
