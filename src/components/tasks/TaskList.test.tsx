import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { getUserTimeZone } from "@/modules/core/time-zone";
import type { Task } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));
const setContextSelection = vi.hoisted(() => vi.fn());
vi.mock("@/lib/preferences-actions", () => ({ setContextSelection }));

import { TaskList } from "./TaskList";

const TODAY = "2026-11-19";
const PARENT_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function renderList(
  tasks: Task[],
  {
    filtered = false,
    showContext = true,
    openQuickAdd = vi.fn(),
    listQuery = "",
  } = {},
) {
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={openQuickAdd}>
        <TaskList
          tasks={tasks}
          today={TODAY}
          side="pro"
          filtered={filtered}
          showContext={showContext}
          listQuery={listQuery}
        />
      </OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
  return { openQuickAdd };
}

const sectionTitles = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

afterEach(() => {
  runAppAction.mockReset();
  setContextSelection.mockReset();
});

describe("liste des tâches : sections", () => {
  it("range les tâches par échéance, sections vides omises", () => {
    renderList([
      buildTask({ title: "Plus tard", dueDate: "2026-12-01" }),
      buildTask({ title: "Sans date" }),
      buildTask({ title: "Hier", dueDate: "2026-11-18" }),
      buildTask({ title: "Demain", dueDate: "2026-11-20" }),
    ]);

    expect(sectionTitles()).toEqual([
      "En retard",
      "Demain",
      "Plus tard",
      "Sans échéance",
    ]);
    const overdue = screen.getByRole("region", { name: "En retard" });
    expect(within(overdue).getByRole("link", { name: /Hier/ })).toBeTruthy();
  });

  it("montre le compteur n/m sur la parente", () => {
    renderList([
      buildTask({
        title: "Préparer le salon",
        subtaskTotal: 3,
        subtaskDone: 1,
      }),
    ]);

    expect(screen.getByText("1/3")).toBeTruthy();
    expect(
      screen.getByText("1 sous-tâche terminée sur 3", { selector: ".sr-only" }),
    ).toBeTruthy();
  });

  it("sous-tâche avec échéance : ligne dans sa section, titre de la parente en légende ; sans échéance : aucune ligne", () => {
    renderList([
      buildTask({
        title: "Réserver la salle",
        parentId: PARENT_ID,
        parentTitle: "Préparer le salon",
        dueDate: TODAY,
      }),
      buildTask({
        title: "Imprimer les flyers",
        parentId: PARENT_ID,
        parentTitle: "Préparer le salon",
      }),
    ]);

    const today = screen.getByRole("region", { name: "Aujourd'hui" });
    expect(within(today).getByText("Réserver la salle")).toBeTruthy();
    expect(within(today).getByText("Préparer le salon")).toBeTruthy();
    expect(screen.queryByText("Imprimer les flyers")).toBeNull();
  });

  it("échéance en retard en braise, espace, tags et heure en légende, lien vers le détail", () => {
    const task = buildTask({
      title: "Relancer le devis",
      dueDate: "2026-11-17",
      dueTime: "14:00",
      contextName: "Trustup",
      tags: ["client"],
      priority: 1,
    });
    renderList([task]);

    const link = screen.getByRole("link", { name: /Relancer le devis/ });
    expect(link.getAttribute("href")).toBe(`/tasks/${task.id}`);
    expect(within(link).getByText("Trustup")).toBeTruthy();
    expect(within(link).getByText("client")).toBeTruthy();
    expect(within(link).getByText("14:00")).toBeTruthy();
    expect(within(link).getByText("Priorité urgente")).toBeTruthy();
    const due = within(link).getByText("17 nov.");
    expect(due.className).toContain("text-destructive");
  });
});

describe("liste des tâches : pastille d'espace", () => {
  it("absente quand il n'y a rien à distinguer (côté à un seul espace, ou espace filtré)", () => {
    renderList(
      [buildTask({ title: "Payer la crèche", contextName: "Privé" })],
      {
        showContext: false,
      },
    );

    const link = screen.getByRole("link", { name: /Payer la crèche/ });
    expect(within(link).queryByText("Privé")).toBeNull();
  });

  it("prend la couleur de l'espace (chip-warm pour Trustup)", () => {
    renderList([
      buildTask({
        title: "Relancer le devis",
        contextName: "Trustup",
        contextColor: "warm",
      }),
    ]);

    const link = screen.getByRole("link", { name: /Relancer le devis/ });
    const chip = within(link).getByText("Trustup").className.split(/\s+/);
    expect(chip).toEqual(
      expect.arrayContaining(["bg-chip-warm", "text-chip-warm-foreground"]),
    );
    expect(chip).not.toContain("bg-chip-neutral");
  });
});

describe("liste des tâches : cocher", () => {
  it("case désactivée pendant l'appel, sans mise à jour optimiste, puis erreur dans la ligne", async () => {
    const call = deferred<unknown>();
    runAppAction.mockReturnValue(call.promise);
    const task = buildTask({ title: "Payer la crèche" });
    renderList([task]);

    const box = screen.getByRole("checkbox", {
      name: "Terminer « Payer la crèche »",
    }) as HTMLInputElement;
    fireEvent.click(box);

    await waitFor(() => expect(box.disabled).toBe(true));
    expect(box.checked).toBe(false);
    expect(runAppAction).toHaveBeenCalledWith("tasks.complete", {
      taskId: task.id,
    });

    await act(async () => call.resolve({ ok: false, code: "not_found" }));

    const row = screen.getByRole("listitem");
    expect(
      within(row).getByText("Tâche introuvable ou à la corbeille."),
    ).toBeTruthy();
    expect(box.disabled).toBe(false);
    expect(box.checked).toBe(false);
  });

  it("panne sans code : message générique dans la ligne", async () => {
    runAppAction.mockRejectedValue(new Error("panne"));
    renderList([buildTask({ title: "Payer la crèche" })]);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(
      await screen.findByText("Tâche non mise à jour. Réessaie."),
    ).toBeTruthy();
  });

  it("une tâche terminée se rouvre (catégorie À faire)", async () => {
    runAppAction.mockResolvedValue({ ok: true, result: {} });
    const task = buildTask({
      title: "Acheter des ampoules",
      statusCategory: "completed",
      completedAt: new Date("2026-11-18T10:00:00Z"),
    });
    renderList([task]);

    const box = screen.getByRole("checkbox", {
      name: "Rouvrir « Acheter des ampoules »",
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    expect(sectionTitles()).toEqual(["Terminées"]);
    fireEvent.click(box);

    await waitFor(() =>
      expect(runAppAction).toHaveBeenCalledWith("tasks.update", {
        taskId: task.id,
        statusCategory: "unstarted",
      }),
    );
  });
});

describe("liste des tâches : tâche annulée", () => {
  function renderCanceled() {
    const task = buildTask({
      title: "Réserver le resto",
      statusCategory: "canceled",
      completedAt: new Date("2026-11-18T10:00:00Z"),
    });
    renderList([task]);
    return task;
  }

  it("se lit comme fermée : case cochée, libellé adapté, repère Annulée visible", () => {
    renderCanceled();

    const box = screen.getByRole("checkbox", {
      name: "Rouvrir « Réserver le resto », annulée",
    }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    const link = screen.getByRole("link", { name: /Réserver le resto/ });
    expect(within(link).getByText("Annulée")).toBeTruthy();
  });

  it("un tap la rouvre vers À faire, jamais tasks.complete", async () => {
    runAppAction.mockResolvedValue({ ok: true, result: {} });
    const task = renderCanceled();

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() =>
      expect(runAppAction).toHaveBeenCalledWith("tasks.update", {
        taskId: task.id,
        statusCategory: "unstarted",
      }),
    );
    expect(runAppAction).not.toHaveBeenCalledWith(
      "tasks.complete",
      expect.anything(),
    );
  });
});

describe("liste des tâches : états vides", () => {
  it("vide : une phrase et un bouton qui ouvre l'ajout rapide", () => {
    const { openQuickAdd } = renderList([]);

    fireEvent.click(screen.getByRole("button", { name: "Ajouter une tâche" }));

    expect(openQuickAdd).toHaveBeenCalledOnce();
    expect(screen.queryByText("Rien dans cet espace")).toBeNull();
  });

  it("vide aussi quand seules des sous-tâches sans échéance existent", () => {
    renderList([buildTask({ parentId: PARENT_ID, parentTitle: "Parente" })]);

    expect(
      screen.getByRole("button", { name: "Ajouter une tâche" }),
    ).toBeTruthy();
  });

  it("vide filtré : Rien dans cet espace, et Voir tous les espaces retire le filtre du côté", async () => {
    setContextSelection.mockResolvedValue(undefined);
    renderList([], { filtered: true });

    expect(screen.getByText("Rien dans cet espace")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Voir tous les espaces" }),
    );

    await waitFor(() =>
      expect(setContextSelection).toHaveBeenCalledWith("pro", null),
    );
  });
});

describe("liste des tâches : lien vers le détail", () => {
  it("terminées affichées : le lien de la ligne garde ?completed=1", () => {
    const task = buildTask({ title: "Relancer le devis" });
    renderList([task], { listQuery: "?completed=1" });

    expect(
      screen
        .getByRole("link", { name: /Relancer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${task.id}?completed=1`);
  });
});
