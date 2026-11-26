import { render, screen, within } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOARD_CARDS_CLASSES,
  BOARD_COLUMN_CLASSES,
  BOARD_COLUMN_FOLDED_CLASSES,
  BOARD_COLUMN_OPEN_CLASSES,
  BOARD_COLUMN_UNCHOSEN_CLASSES,
  BOARD_COLUMNS_CLASSES,
  BOARD_HEADER_CLASSES,
  BOARD_HEADING_CLASSES,
  BOARD_TAB_HEIGHT,
  BOARD_TABLIST_CLASSES,
  BOARD_TABS_CLASSES,
  TASK_CARD_CLASSES,
  TASK_CARD_LEGEND_CLASSES,
  TASK_CARD_LEGEND_TEXT,
  TASK_CARD_SHADOW,
  TASK_CARD_TITLE_TEXT,
} from "@/components/tasks/task-board-layout";
import {
  TASK_LIST_CLASSES,
  TASK_LIST_ROW_SURFACE_CLASSES,
  TASK_ROW_CLASSES,
  TASK_ROW_LEGEND_CLASSES,
  TASK_ROW_LEGEND_STRUT_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_LINE_CLASSES,
  TASK_ROW_TEXT_CLASSES,
  TASK_ROW_TITLE_TEXT,
  TASK_ROWS_CLASSES,
  TASK_SECTION_CLASSES,
  TASK_SECTION_HEADER_CLASSES,
  TASK_SECTION_HEADING_TEXT,
} from "@/components/tasks/task-list-layout";

import messages from "../../../../../messages/fr.json";

function expectClasses(element: HTMLElement, classes: string) {
  expect(element.className.split(/\s+/)).toEqual(
    expect.arrayContaining(classes.split(" ")),
  );
}

const pageHeaderProps = vi.hoisted(() => vi.fn());
const completedToggleProps = vi.hoisted(() => vi.fn());
const viewSwitchProps = vi.hoisted(() => vi.fn());
const boardOptionsProps = vi.hoisted(() => vi.fn());
const readTasksView = vi.hoisted(() => vi.fn());
const readBoardOptions = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "tasks.list") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son titre et ses actions.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; actions?: React.ReactNode }) => {
    pageHeaderProps(props);
    return (
      <header>
        <h1>{props.title}</h1>
        {props.actions}
      </header>
    );
  },
}));
vi.mock("@/components/tasks/CompletedToggle", () => ({
  CompletedToggle: (props: { checked: boolean; href: string }) => {
    completedToggleProps(props);
    return <button type="button">{messages.tasks.list.completedToggle}</button>;
  },
}));

// Contrôles clients (testés à part) : seule leur place compte ici, tenue par un bloc repérable.
vi.mock("@/components/tasks/ViewSwitch", () => ({
  ViewSwitch: (props: { view: string }) => {
    viewSwitchProps(props);
    return <div data-testid="view-switch" />;
  },
}));
vi.mock("@/components/tasks/BoardOptions", () => ({
  BoardOptions: (props: unknown) => {
    boardOptionsProps(props);
    return <div data-testid="board-options" />;
  },
}));
vi.mock("@/lib/preferences", () => ({ readTasksView, readBoardOptions }));

import TasksLoading from "./loading";

function expectReserved(control: HTMLElement) {
  const holder = control.parentElement as HTMLElement;
  expect(holder.classList.contains("invisible")).toBe(true);
  expect(holder.getAttribute("aria-hidden")).toBe("true");
  expect(holder.hasAttribute("inert")).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  readTasksView.mockResolvedValue("list");
  readBoardOptions.mockResolvedValue({
    subtasks: true,
    hideDoneSubtasks: false,
    canceledOpen: false,
  });
});

describe("chargement de la liste des tâches", () => {
  it("pendant le chargement, le filtre d'espace est présent mais inerte et masqué (place réservée)", async () => {
    render(await TasksLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ filterInert: true }),
    );
    expect(pageHeaderProps).not.toHaveBeenCalledWith(
      expect.objectContaining({ contextFilter: false }),
    );
  });

  it("titre par l'en-tête de page, statut, givre à la géométrie de la liste, sans verre, aucun squelette", async () => {
    const { container } = render(await TasksLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ title: messages.tasks.list.title }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: messages.tasks.list.title,
      }),
    ).toBeTruthy();
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement des tâches…",
    );
    const holder = screen.getByTestId("tasks-frost");
    expect(holder.textContent).toBe("");
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.children).toHaveLength(1);
    const list = holder.firstElementChild as HTMLElement;
    expectClasses(list, TASK_LIST_CLASSES);
    // Sections creusées posées à nu sur la brume, comme la vraie liste : plus de tuile de verre.
    expect(holder.querySelector(".glass")).toBeNull();
    expect(list.querySelector(":scope > .frost")).toBeNull();
    expect(container.querySelector(".bg-track")).toBeNull();
  });

  it("givre : une section creusée voilée, son en-tête puis six lignes en cartes claires voilées, aux classes partagées avec TaskList et TaskRow", async () => {
    render(await TasksLoading());

    const header = screen.getByTestId("tasks-frost-section-header");
    const rows = screen.getAllByTestId("tasks-frost-row");
    const section = header.parentElement as HTMLElement;
    expectClasses(section, TASK_SECTION_CLASSES);
    expectClasses(section, "rounded-tile bg-pill-track p-tile");
    expect(section.querySelectorAll(":scope > .frost")).toHaveLength(1);
    expect(section.parentElement?.children).toHaveLength(1);
    expectClasses(header, TASK_SECTION_HEADER_CLASSES);
    expectClasses(
      header.firstElementChild as HTMLElement,
      `${TASK_SECTION_HEADING_TEXT} h-lh`,
    );
    expect(rows).toHaveLength(6);
    expectClasses(rows[0].parentElement as HTMLElement, TASK_ROWS_CLASSES);
    rows.forEach((row, i) => {
      expectClasses(row, TASK_ROW_CLASSES.replace(" bg-row", ""));
      expectClasses(row, TASK_LIST_ROW_SURFACE_CLASSES);
      expect(row.classList.contains("bg-row")).toBe(false);
      expect(row.querySelectorAll(".frost")).toHaveLength(1);
      expect(row.style.getPropertyValue("--frost-index")).toBe(String(i + 1));
      const line = row.querySelector(":scope > div:not(.frost)") as HTMLElement;
      expectClasses(line, TASK_ROW_LINE_CLASSES);
      const text = line.firstElementChild as HTMLElement;
      expectClasses(text, TASK_ROW_TEXT_CLASSES);
      const [title, legend] = Array.from(text.children) as HTMLElement[];
      expectClasses(title, `${TASK_ROW_TITLE_TEXT} h-lh`);
      expectClasses(
        legend,
        `${TASK_ROW_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`,
      );
      expectClasses(
        legend.firstElementChild as HTMLElement,
        TASK_ROW_LEGEND_STRUT_CLASSES,
      );
    });
  });

  it("réserve la place de l'interrupteur « Terminées » sans le montrer : l'en-tête ne bouge pas à l'arrivée", async () => {
    const { container } = render(await TasksLoading());

    expect(completedToggleProps).toHaveBeenCalledTimes(1);
    const toggle = screen.getByRole("button", { hidden: true });
    const holder = toggle.parentElement as HTMLElement;
    expect(holder.classList.contains("invisible")).toBe(true);
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("header")?.contains(holder)).toBe(true);
  });

  it("vue Liste mémorisée : givre de la liste, place du sélecteur de vue réservée devant l'interrupteur, aucun givre de tableau", async () => {
    const { container } = render(await TasksLoading());

    expect(screen.getByTestId("tasks-frost")).toBeTruthy();
    expect(screen.queryByTestId("tasks-board-frost")).toBeNull();
    expect(screen.queryByTestId("board-options")).toBeNull();
    expect(readBoardOptions).not.toHaveBeenCalled();
    const viewSwitch = screen.getByTestId("view-switch");
    expect(viewSwitchProps).toHaveBeenCalledExactlyOnceWith({ view: "list" });
    expectReserved(viewSwitch);
    expect(container.querySelector("header")?.contains(viewSwitch)).toBe(true);
    expect(
      viewSwitch.parentElement!.compareDocumentPosition(
        screen.getByRole("button", { hidden: true }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("chargement du tableau des tâches (vue Tableau mémorisée)", () => {
  beforeEach(() => readTasksView.mockResolvedValue("board"));

  it("givre du tableau à la place de celui de la liste, titre et statut gardés, sans interrupteur « Terminées »", async () => {
    const { container } = render(await TasksLoading());

    expect(screen.queryByTestId("tasks-frost")).toBeNull();
    const frost = screen.getByTestId("tasks-board-frost");
    expect(frost.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement des tâches…",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "To-do" }),
    ).toBeTruthy();
    expect(completedToggleProps).not.toHaveBeenCalled();
    expect(container.querySelector(".bg-track")).toBeNull();
  });

  it("réserve la place du sélecteur de vue et de la rangée d'options, invisibles et inertes : le tableau ne bouge pas à l'arrivée", async () => {
    readBoardOptions.mockResolvedValue({
      subtasks: false,
      hideDoneSubtasks: true,
      canceledOpen: false,
    });

    const { container } = render(await TasksLoading());

    const viewSwitch = screen.getByTestId("view-switch");
    expect(viewSwitchProps).toHaveBeenCalledExactlyOnceWith({ view: "board" });
    expectReserved(viewSwitch);
    expect(container.querySelector("header")?.contains(viewSwitch)).toBe(true);
    const options = screen.getByTestId("board-options");
    expect(boardOptionsProps).toHaveBeenCalledExactlyOnceWith({
      subtasks: false,
      hideDoneSubtasks: true,
    });
    expectReserved(options);
    expect(
      options.compareDocumentPosition(screen.getByTestId("tasks-board-frost")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("barre d'onglets givrée sous 768 px, à la hauteur d'un onglet", async () => {
    render(await TasksLoading());

    const tabs = screen.getByTestId("tasks-board-frost-tabs");
    expectClasses(tabs, BOARD_TABS_CLASSES);
    expect(tabs.querySelectorAll(".frost")).toHaveLength(1);
    const bar = tabs.querySelector(":scope > div:not(.frost)") as HTMLElement;
    expectClasses(bar, BOARD_TABLIST_CLASSES);
    expectClasses(bar.firstElementChild as HTMLElement, BOARD_TAB_HEIGHT);
  });

  it("cinq colonnes aux classes du tableau : la première seule sous 768 px, Annulée repliée en bandeau", async () => {
    render(await TasksLoading());

    const columns = screen.getAllByTestId("tasks-board-frost-column");
    expect(columns).toHaveLength(5);
    expectClasses(
      columns[0].parentElement as HTMLElement,
      BOARD_COLUMNS_CLASSES,
    );
    expectClasses(
      columns[0],
      `${BOARD_COLUMN_CLASSES} ${BOARD_COLUMN_OPEN_CLASSES}`,
    );
    for (const column of columns.slice(1)) {
      expectClasses(column, BOARD_COLUMN_UNCHOSEN_CLASSES);
    }
    for (const column of columns.slice(0, 4)) {
      expectClasses(column, BOARD_COLUMN_OPEN_CLASSES);
      const header = column.querySelector(
        ":scope > div:not(.frost)",
      ) as HTMLElement;
      expectClasses(header, BOARD_HEADER_CLASSES);
      expectClasses(
        header.firstElementChild as HTMLElement,
        BOARD_HEADING_CLASSES,
      );
    }
    expectClasses(columns[4], BOARD_COLUMN_FOLDED_CLASSES);
    expect(columns[4].classList.contains("md:w-80")).toBe(false);
    // Bandeau : large comme son libellé, écrit sans être montré.
    const label = columns[4].querySelector(".invisible") as HTMLElement;
    expect(label.textContent).toContain("Annulée");
  });

  it("Annulée dépliée selon la préférence : une colonne comme les autres", async () => {
    readBoardOptions.mockResolvedValue({
      subtasks: true,
      hideDoneSubtasks: false,
      canceledOpen: true,
    });

    render(await TasksLoading());

    const canceled = screen.getAllByTestId("tasks-board-frost-column")[4];
    expectClasses(canceled, BOARD_COLUMN_OPEN_CLASSES);
    expect(canceled.classList.contains("md:w-auto")).toBe(false);
  });

  it("cartes givrées aux classes de la vraie carte, titre et légende sur une ligne chacun", async () => {
    render(await TasksLoading());

    const column = screen.getAllByTestId("tasks-board-frost-column")[0];
    const cards = within(column).getAllByTestId("tasks-board-frost-card");
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expectClasses(cards[0].parentElement as HTMLElement, BOARD_CARDS_CLASSES);
    for (const card of cards) {
      expectClasses(card, `${TASK_CARD_CLASSES} ${TASK_CARD_SHADOW}`);
      expect(card.querySelectorAll(".frost")).toHaveLength(1);
      const [title, legend] = Array.from(
        card.querySelectorAll(":scope > div:not(.frost)"),
      ) as HTMLElement[];
      expectClasses(title, `${TASK_CARD_TITLE_TEXT} h-lh`);
      expectClasses(
        legend,
        `${TASK_CARD_LEGEND_CLASSES} ${TASK_CARD_LEGEND_TEXT}`,
      );
      expectClasses(legend.firstElementChild as HTMLElement, "h-lh");
    }
    // Bandeau replié : aucune carte.
    const band = screen.getAllByTestId("tasks-board-frost-column")[4];
    expect(within(band).queryAllByTestId("tasks-board-frost-card")).toEqual([]);
  });
});
