import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";
import { todayTileItems } from "@/modules/tasks/view";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import { TodayTile } from "./TodayTile";

const TODAY = "2026-11-19";

type TodayTileProps = Parameters<typeof TodayTile>[0];

function renderTile(props: Partial<TodayTileProps> = {}) {
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <TodayTile
        hasSpaces
        today={TODAY}
        due={todayTileItems([], TODAY)}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

const tile = () => screen.getByTestId("tile-today");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T09:00:00+01:00"));
});

afterEach(() => {
  vi.useRealTimers();
  runAppAction.mockReset();
});

describe("tuile « Aujourd'hui »", () => {
  it("compteurs en retard / aujourd'hui, 3 lignes, côté en légende, lien vers la to-do", () => {
    const due = todayTileItems(
      [
        buildTask({
          title: "Payer la crèche",
          side: "private",
          dueDate: "2026-11-18",
        }),
        buildTask({
          title: "Relancer le devis",
          side: "pro",
          dueDate: TODAY,
          dueTime: "14:00",
        }),
        buildTask({
          title: "Appeler le garage",
          side: "private",
          dueDate: TODAY,
        }),
        buildTask({ title: "Quatrième", side: "pro", dueDate: TODAY }),
      ],
      TODAY,
    );

    renderTile({ due });

    expect(within(tile()).getByTestId("today-overdue-count").textContent).toBe(
      "1",
    );
    expect(within(tile()).getByTestId("today-due-count").textContent).toBe("3");
    const rows = within(
      within(tile()).getByRole("list", { name: "Tâches du jour" }),
    ).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("Payer la crèche");
    expect(rows[0].textContent).toContain("Privé");
    expect(rows[1].textContent).toContain("Relancer le devis");
    expect(rows[1].textContent).toContain("Pro");
    expect(rows[1].textContent).toContain("14:00");
    expect(tile().textContent).not.toContain("Quatrième");
    const seeAll = within(tile()).getByRole("link", { name: "Voir la to-do" });
    expect(seeAll.getAttribute("href")).toBe("/tasks");
  });

  it("une ligne mène au détail ; une sous-tâche porte le titre de sa parente en légende", () => {
    const task = buildTask({
      title: "Réserver la salle",
      parentId: "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      parentTitle: "Préparer le salon",
      dueDate: TODAY,
    });

    renderTile({ due: todayTileItems([task], TODAY) });

    const link = within(tile()).getByRole("link", {
      name: /Réserver la salle/,
    });
    expect(link.getAttribute("href")).toBe(`/tasks/${task.id}`);
    expect(within(link).getByText("Préparer le salon")).toBeTruthy();
  });

  it("cocher une ligne la termine : case désactivée pendant l'appel, erreur dans la ligne", async () => {
    let resolve!: (value: unknown) => void;
    runAppAction.mockReturnValue(new Promise((r) => (resolve = r)));
    const task = buildTask({ title: "Payer la crèche", dueDate: TODAY });
    renderTile({ due: todayTileItems([task], TODAY) });

    const box = within(tile()).getByRole("checkbox", {
      name: "Terminer « Payer la crèche »",
    }) as HTMLInputElement;
    fireEvent.click(box);

    await waitFor(() => expect(box.disabled).toBe(true));
    expect(box.checked).toBe(false);
    expect(runAppAction).toHaveBeenCalledWith("tasks.complete", {
      taskId: task.id,
    });

    await act(async () => resolve({ ok: false, code: "not_found" }));

    expect(
      within(tile()).getByText("Tâche introuvable ou à la corbeille."),
    ).toBeTruthy();
    expect(box.disabled).toBe(false);
  });

  it("rien en retard ni aujourd'hui : une phrase le dit, ni compteur ni ligne", () => {
    renderTile();

    expect(tile().textContent).toContain(messages.dashboard.today.introClear);
    expect(within(tile()).queryByTestId("today-overdue-count")).toBeNull();
    expect(within(tile()).queryByRole("list")).toBeNull();
  });

  it("côté sans espace : la tuile le dit", () => {
    renderTile({ hasSpaces: false });

    expect(tile().textContent).toContain(messages.dashboard.today.introNoSpace);
  });

  it("lecture en échec : message d'erreur, la date et la salutation restent", () => {
    renderTile({ due: null });

    expect(within(tile()).getByRole("status").textContent).toBe(
      messages.dashboard.today.error,
    );
    expect(tile().textContent).toContain("jeudi 19 novembre");
    expect(tile().textContent).toContain(messages.dashboard.today.greeting);
    expect(within(tile()).queryByTestId("today-overdue-count")).toBeNull();
  });
});
