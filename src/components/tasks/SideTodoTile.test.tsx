import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { buildDashboard } from "@/modules/dashboard/tiles";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { Task } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import { SideTodoTile } from "./SideTodoTile";

const TODAY = "2026-11-19";
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

const proTodo = () => {
  const tile = buildDashboard({
    side: "pro",
    contexts: [TRUSTUP, NEXXIA],
    selected: [TRUSTUP.id, NEXXIA.id],
  }).tiles.find((t) => t.id === "proTodo");
  if (!tile) throw new Error("tuile proTodo absente du catalogue");
  return tile;
};

function renderTile(
  tasks: Task[] | null,
  { showContext = true, openQuickAdd = vi.fn() } = {},
) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={openQuickAdd}>
        <SideTodoTile
          tile={proTodo()}
          tasks={tasks}
          today={TODAY}
          showContext={showContext}
        />
      </OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
  return { openQuickAdd };
}

const tile = () => screen.getByTestId("tile-proTodo");

afterEach(() => runAppAction.mockReset());

describe("tuile « To-do pro »", () => {
  it("5 prochaines du côté, case à cocher comprise, lien Tout voir vers /tasks", () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      buildTask({ side: "pro", title: `Pro ${i}`, dueDate: `2026-11-2${i}` }),
    );

    renderTile(tasks);

    const rows = within(
      within(tile()).getByRole("list", { name: "Prochaines tâches" }),
    ).getAllByRole("listitem");
    expect(
      rows.map((row) => within(row).getByRole("link").textContent),
    ).toEqual(
      ["Pro 0", "Pro 1", "Pro 2", "Pro 3", "Pro 4"].map((title) =>
        expect.stringContaining(title),
      ),
    );
    expect(within(rows[0]).getByRole("checkbox")).toBeTruthy();
    const seeAll = within(tile()).getByRole("link", { name: "Tout voir" });
    expect(seeAll.getAttribute("href")).toBe("/tasks");
  });

  it("5 lignes même avec des sous-tâches sans échéance parmi les tâches reçues", () => {
    const parent = buildTask({ side: "pro", title: "Parente" });
    const tasks = [
      parent,
      ...Array.from({ length: 3 }, (_, i) =>
        buildTask({
          side: "pro",
          title: `Sous ${i}`,
          parentId: parent.id,
          parentTitle: "Parente",
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        buildTask({ side: "pro", title: `Libre ${i}` }),
      ),
    ];

    renderTile(tasks);

    const rows = within(
      within(tile()).getByRole("list", { name: "Prochaines tâches" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(tile().textContent).not.toContain("Sous 0");
  });

  it("échéance passée écrite en braise ; espaces nommés quand il y a à distinguer", () => {
    renderTile([
      buildTask({
        side: "pro",
        title: "Relancer le devis",
        dueDate: "2026-11-17",
        contextName: "Trustup",
      }),
    ]);

    const link = within(tile()).getByRole("link", {
      name: /Relancer le devis/,
    });
    expect(within(link).getByText("17 nov.").className).toContain(
      "text-destructive",
    );
    expect(within(link).getByText("Trustup")).toBeTruthy();
  });

  it("vide : dit à quoi sert la tuile et propose d'ajouter une tâche", () => {
    const { openQuickAdd } = renderTile([]);

    expect(tile().textContent).toContain(messages.dashboard.tiles.proTodo.body);
    fireEvent.click(
      within(tile()).getByRole("button", { name: "Ajouter une tâche" }),
    );
    expect(openQuickAdd).toHaveBeenCalledOnce();
  });

  it("lecture en échec : message d'erreur, titre et lien restent", () => {
    renderTile(null);

    expect(within(tile()).getByRole("status").textContent).toBe(
      messages.dashboard.tiles.tasksError,
    );
    expect(tile().textContent).toContain(
      messages.dashboard.tiles.proTodo.title,
    );
    expect(
      within(tile()).queryByRole("list", { name: "Prochaines tâches" }),
    ).toBeNull();
  });
});
