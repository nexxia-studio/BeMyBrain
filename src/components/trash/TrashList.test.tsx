import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contextColorClass } from "@/components/tasks/context-chip-class";
import { TaskTrashRow } from "@/components/tasks/TaskTrashRow";
import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import type { TrashItem } from "./trash-item";
import { TrashList } from "./TrashList";

const PARENT = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const DELETED_AT = new Date("2026-11-18T09:00:00Z");
const NOW = new Date("2026-11-19T10:00:00Z");

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function taskItem(
  overrides: Parameters<typeof buildTask>[0],
  subtaskCount = 0,
): TrashItem {
  const task = { ...buildTask(overrides), deletedAt: DELETED_AT };
  return {
    key: `task:${task.id}`,
    deletedAt: DELETED_AT,
    restore: { action: "tasks.restore", params: { taskId: task.id } },
    row: <TaskTrashRow item={{ task, subtaskCount }} />,
  };
}

function renderList(items: TrashItem[]) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
      now={NOW}
    >
      <TrashList items={items} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.clearAllMocks());

describe("TrashList", () => {
  it("parente : titre, « + n sous-tâches » et date de mise à la corbeille, sans case à cocher", () => {
    renderList([taskItem({ id: PARENT, title: "Déménager" }, 2)]);

    expect(screen.getByText("Déménager")).toBeTruthy();
    expect(screen.getByText("+ 2 sous-tâches")).toBeTruthy();
    expect(screen.getByText("Mise à la corbeille le 18 nov.")).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("les deux côtés ensemble : chaque ligne porte la pastille de côté et celle de son espace, en couleur", () => {
    renderList([
      taskItem({
        title: "Déménager",
        side: "private",
        contextName: "Maison",
        contextColor: "warm",
      }),
      taskItem({
        title: "Relancer le devis",
        side: "pro",
        contextName: "Nexxia",
        contextColor: "indigo",
      }),
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Privé")).toBeTruthy();
    expect(within(rows[1]).getByText("Pro")).toBeTruthy();
    expect(within(rows[0]).getByText("Maison").className).toContain(
      contextColorClass.warm,
    );
    expect(within(rows[1]).getByText("Nexxia").className).toContain(
      contextColorClass.indigo,
    );
  });

  it("mise à la corbeille une autre année : l'année est écrite", () => {
    const deletedAt = new Date("2025-12-30T10:00:00Z");
    const item = taskItem({ title: "Déménager" });

    renderList([{ ...item, deletedAt }]);

    expect(
      screen.getByText("Mise à la corbeille le 30 déc. 2025"),
    ).toBeTruthy();
  });

  it("sous-tâche seule : le titre de sa parente en légende", () => {
    renderList([
      taskItem({
        title: "Cartons",
        parentId: PARENT,
        parentTitle: "Déménager",
      }),
    ]);

    expect(screen.getByText("Cartons")).toBeTruthy();
    expect(screen.getByText("Déménager")).toBeTruthy();
    expect(screen.queryByText(/sous-tâches?$/)).toBeNull();
  });

  it("Restaurer : appelle l'action déclarée, bouton désactivé pendant l'appel", async () => {
    const call = deferred<unknown>();
    runAppAction.mockReturnValue(call.promise);
    renderList([taskItem({ id: PARENT, title: "Déménager" })]);
    const button = screen.getByRole("button", { name: "Restaurer" });

    fireEvent.click(button);

    expect(runAppAction).toHaveBeenCalledWith("tasks.restore", {
      taskId: PARENT,
    });
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Restauration…" })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    call.resolve({ ok: true, result: {} });
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Restaurer" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Restaurer refusé : message traduit du code dans la ligne", async () => {
    runAppAction.mockResolvedValue({ ok: false, code: "parent_in_trash" });
    renderList([taskItem({ parentId: PARENT, parentTitle: "Déménager" })]);

    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "La tâche parente est à la corbeille. Restaure-la d'abord.",
    );
  });

  it("Restaurer en panne : message générique dans la ligne", async () => {
    runAppAction.mockRejectedValue(new Error("réseau"));
    renderList([taskItem({ title: "Déménager" })]);

    fireEvent.click(screen.getByRole("button", { name: "Restaurer" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Non restauré. Réessaie.",
    );
  });

  it("vide : « La corbeille est vide »", () => {
    renderList([]);

    expect(screen.getByText("La corbeille est vide")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
