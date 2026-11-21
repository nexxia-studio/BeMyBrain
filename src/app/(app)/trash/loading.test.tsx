import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SIDE_CHIP_CLASSES,
  TASK_ROW_LEGEND_TEXT,
  TASK_ROW_TITLE_TEXT,
  TASK_TRASH_LEGEND_CLASSES,
  TASK_TRASH_ROW_CLASSES,
} from "@/components/tasks/task-list-layout";
import {
  TRASH_LIST_TILE_CLASSES,
  TRASH_ROW_CLASSES,
  TRASH_ROW_CONTENT_CLASSES,
  TRASH_ROW_DATE_TEXT,
  TRASH_ROW_LINE_CLASSES,
  TRASH_ROWS_CLASSES,
} from "@/components/trash/trash-list-layout";

import messages from "../../../../messages/fr.json";

function expectClasses(element: HTMLElement, classes: string) {
  expect(element.className.split(/\s+/)).toEqual(
    expect.arrayContaining(classes.split(" ")),
  );
}

const pageHeaderProps = vi.hoisted(() => vi.fn());

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "trash") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son seul titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; contextFilter?: boolean }) => {
    pageHeaderProps(props);
    return <h1>{props.title}</h1>;
  },
}));

import TrashLoading from "./loading";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chargement de la corbeille", () => {
  it("titre par l'en-tête de page (sans filtre d'espace), statut, une tuile givrée pleine largeur à la géométrie de la corbeille, aucun squelette", async () => {
    const { container } = render(await TrashLoading());

    expect(pageHeaderProps).toHaveBeenCalledWith({
      title: messages.trash.title,
      contextFilter: false,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: messages.trash.title }),
    ).toBeTruthy();
    expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement de la corbeille…",
    );

    const holder = screen.getByTestId("trash-frost");
    expect(holder.textContent).toBe("");
    expect(holder.getAttribute("aria-hidden")).toBe("true");
    expect(holder.children).toHaveLength(1);
    const tile = holder.firstElementChild as HTMLElement;
    expect(tile.classList.contains("glass")).toBe(true);
    expectClasses(tile, TRASH_LIST_TILE_CLASSES);
    expect(tile.className).not.toMatch(/max-w-/);
    expect(container.querySelector(".bg-track")).toBeNull();
  });

  it("givre : six lignes, aux classes partagées avec TrashList, TrashRow et TaskTrashRow, sans en-tête de section", async () => {
    render(await TrashLoading());

    const rows = screen.getAllByTestId("trash-frost-row");
    expect(rows).toHaveLength(6);
    expect(screen.queryByTestId("tasks-frost-section-header")).toBeNull();
    expectClasses(rows[0].parentElement as HTMLElement, TRASH_ROWS_CLASSES);
    rows.forEach((row, i) => {
      expectClasses(row, TRASH_ROW_CLASSES);
      expect(row.querySelectorAll(".frost")).toHaveLength(1);
      expect(row.style.getPropertyValue("--frost-index")).toBe(String(i + 1));
      const line = row.querySelector(":scope > div:not(.frost)") as HTMLElement;
      expectClasses(line, TRASH_ROW_LINE_CLASSES);
      const content = line.firstElementChild as HTMLElement;
      expectClasses(content, TRASH_ROW_CONTENT_CLASSES);
      const [task, date] = Array.from(content.children) as HTMLElement[];
      expectClasses(task, TASK_TRASH_ROW_CLASSES);
      expectClasses(date, `${TRASH_ROW_DATE_TEXT} h-lh`);
      const [title, legend] = Array.from(task.children) as HTMLElement[];
      expectClasses(title, `${TASK_ROW_TITLE_TEXT} h-lh`);
      expectClasses(
        legend,
        `${TASK_TRASH_LEGEND_CLASSES} ${TASK_ROW_LEGEND_TEXT}`,
      );
      expectClasses(
        legend.firstElementChild as HTMLElement,
        `${SIDE_CHIP_CLASSES} box-content h-lh`,
      );
    });
  });
});
