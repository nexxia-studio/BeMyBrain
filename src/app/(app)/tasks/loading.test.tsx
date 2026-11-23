import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TASK_LIST_TILE_CLASSES,
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

import messages from "../../../../messages/fr.json";

function expectClasses(element: HTMLElement, classes: string) {
  expect(element.className.split(/\s+/)).toEqual(
    expect.arrayContaining(classes.split(" ")),
  );
}

const pageHeaderProps = vi.hoisted(() => vi.fn());
const completedToggleProps = vi.hoisted(() => vi.fn());

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

import TasksLoading from "./loading";

beforeEach(() => {
  vi.clearAllMocks();
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

  it("titre par l'en-tête de page, statut, une tuile givrée à la géométrie de la liste, aucun squelette", async () => {
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
    const tile = holder.firstElementChild as HTMLElement;
    expect(tile.classList.contains("glass")).toBe(true);
    expectClasses(tile, TASK_LIST_TILE_CLASSES);
    expect(container.querySelector(".bg-track")).toBeNull();
  });

  it("givre : un en-tête de section puis six lignes, aux classes partagées avec TaskList et TaskRow", async () => {
    render(await TasksLoading());

    const header = screen.getByTestId("tasks-frost-section-header");
    const rows = screen.getAllByTestId("tasks-frost-row");
    expectClasses(header.parentElement as HTMLElement, TASK_SECTION_CLASSES);
    expectClasses(header, TASK_SECTION_HEADER_CLASSES);
    expectClasses(
      header.firstElementChild as HTMLElement,
      `${TASK_SECTION_HEADING_TEXT} h-lh`,
    );
    expect(rows).toHaveLength(6);
    expectClasses(rows[0].parentElement as HTMLElement, TASK_ROWS_CLASSES);
    rows.forEach((row, i) => {
      expectClasses(row, TASK_ROW_CLASSES);
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
});
