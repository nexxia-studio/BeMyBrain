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
import type { TaskDetail as TaskDetailData } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));
const push = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ current: "/tasks" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push }),
  usePathname: () => pathname.current,
}));

import { TaskDetail } from "./TaskDetail";
import { TaskTrashProvider } from "./TaskTrashProvider";

const TODAY = "2026-11-19";
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function buildDetail(overrides: Partial<TaskDetailData> = {}): TaskDetailData {
  return {
    ...buildTask({
      title: "Relancer le devis",
      side: "pro",
      contextId: TRUSTUP.id,
      contextName: TRUSTUP.name,
      tags: ["devis"],
    }),
    notes: "Appeler avant midi",
    subtasks: [],
    ...overrides,
  };
}

function tree(task: TaskDetailData | null) {
  return (
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <TaskTrashProvider>
        {task !== null && (
          <TaskDetail
            task={task}
            contexts={[TRUSTUP, NEXXIA]}
            today={TODAY}
            closeHref="/tasks"
          />
        )}
      </TaskTrashProvider>
    </NextIntlClientProvider>
  );
}

function renderDetail(task: TaskDetailData = buildDetail()) {
  const { rerender } = render(tree(task));
  return Object.assign(task, {
    /** Navigation vers la liste (router.push simulé) : le détail quitte la page, le layout reste. */
    leave: () => rerender(tree(null)),
  });
}

/** Paramètres du dernier appel à l'action `name`. */
function paramsOf(name: string): Record<string, unknown> | undefined {
  const call = runAppAction.mock.calls.findLast(([called]) => called === name);
  return call?.[1] as Record<string, unknown> | undefined;
}

const titleField = () => screen.getByRole("textbox", { name: "Titre" });
const chip = (field: RegExp) => screen.getByRole("button", { name: field });

beforeEach(() => {
  vi.clearAllMocks();
  pathname.current = "/tasks";
  runAppAction.mockImplementation(async (name: string) =>
    name === "tasks.listTags"
      ? {
          ok: true,
          result: [
            { id: "t1", name: "client" },
            { id: "t2", name: "devis" },
          ],
        }
      : { ok: true, result: null },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("détail : chaque champ appelle tasks.update", () => {
  it("titre modifié puis quitté : tasks.update avec le nouveau titre, champ désactivé pendant l'appel", async () => {
    const call = deferred<{ ok: true; result: null }>();
    runAppAction.mockReturnValue(call.promise);
    const task = renderDetail();

    fireEvent.change(titleField(), { target: { value: "Relancer Trustup" } });
    fireEvent.blur(titleField());

    expect(paramsOf("tasks.update")).toEqual({
      taskId: task.id,
      title: "Relancer Trustup",
    });
    await waitFor(() =>
      expect((titleField() as HTMLTextAreaElement).disabled).toBe(true),
    );
    call.resolve({ ok: true, result: null });
    await waitFor(() =>
      expect((titleField() as HTMLTextAreaElement).disabled).toBe(false),
    );
  });

  it("titre inchangé : aucun appel", () => {
    renderDetail();

    fireEvent.blur(titleField());

    expect(runAppAction).not.toHaveBeenCalled();
  });

  it("titre vidé : aucun appel, message sous le champ", () => {
    renderDetail();

    fireEvent.change(titleField(), { target: { value: "  " } });
    fireEvent.blur(titleField());

    expect(runAppAction).not.toHaveBeenCalled();
    expect(titleField().getAttribute("aria-describedby")).toBeTruthy();
    expect(
      document.getElementById(
        titleField().getAttribute("aria-describedby") ?? "",
      )?.textContent,
    ).toBe("Le titre ne peut pas être vide.");
  });

  it("refus traduit : erreur sous le champ, reliée par aria-describedby", async () => {
    runAppAction.mockResolvedValue({ ok: false, code: "not_found" });
    renderDetail();

    fireEvent.change(titleField(), { target: { value: "Autre" } });
    fireEvent.blur(titleField());

    await waitFor(() =>
      expect(
        document.getElementById(
          titleField().getAttribute("aria-describedby") ?? "",
        )?.textContent,
      ).toBe("Tâche introuvable ou à la corbeille."),
    );
  });

  it("notes vidées : enregistrées comme absentes (null)", async () => {
    const task = renderDetail();
    const notes = screen.getByRole("textbox", { name: "Notes" });

    fireEvent.change(notes, { target: { value: "" } });
    fireEvent.blur(notes);

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        notes: null,
      }),
    );
  });

  it("statut : En cours → catégorie started", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Statut :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "En cours" }),
    );

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        statusCategory: "started",
      }),
    );
  });

  it("panne pendant le changement de statut : message générique sous le statut, pastille réactivée", async () => {
    runAppAction.mockRejectedValue(new Error("réseau"));
    renderDetail();

    fireEvent.click(chip(/^Statut :/));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Fait" }));

    const status = await screen.findByText(
      "Modification non enregistrée. Réessaie.",
    );
    expect(chip(/^Statut :/).getAttribute("aria-describedby")).toBe(status.id);
    await waitFor(() =>
      expect((chip(/^Statut :/) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("priorité : Haute → 2", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Priorité :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Haute" }),
    );

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        priority: 2,
      }),
    );
  });

  it("côté : Privé → side private", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Côté :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Privé" }),
    );

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        side: "private",
      }),
    );
  });

  it("espace : Nexxia → context par son nom ; Aucun → null", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Espace :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Nexxia" }),
    );
    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        context: "Nexxia",
      }),
    );
    fireEvent.click(chip(/^Espace :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Aucun" }),
    );

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        context: null,
      }),
    );
  });

  it("échéance : Demain → date et heure enregistrées ensemble", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Échéance :/));
    fireEvent.click(await screen.findByRole("button", { name: /^Demain/ }));

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        dueDate: "2026-11-20",
        dueTime: null,
      }),
    );
  });

  it("échéance saisie au champ natif : un seul appel, à la fermeture de la pastille", async () => {
    const task = renderDetail(buildDetail({ dueDate: "2026-11-25" }));

    fireEvent.click(chip(/^Échéance :/));
    const date = await screen.findByLabelText("Choisir…");
    fireEvent.change(date, { target: { value: "2026-12-01" } });
    fireEvent.change(date, { target: { value: "2026-12-02" } });
    expect(paramsOf("tasks.update")).toBeUndefined();
    fireEvent.keyDown(date, { key: "Escape" });

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        dueDate: "2026-12-02",
        dueTime: null,
      }),
    );
    expect(
      runAppAction.mock.calls.filter(([name]) => name === "tasks.update"),
    ).toHaveLength(1);
  });

  it("tags : ajout et retrait envoyés en addTags / removeTags à la fermeture", async () => {
    const task = renderDetail();

    fireEvent.click(chip(/^Tags :/));
    fireEvent.click(await screen.findByRole("button", { name: "client" }));
    fireEvent.click(screen.getByRole("button", { name: "devis" }));
    fireEvent.keyDown(
      screen.getByRole("textbox", { name: "Chercher ou créer un tag" }),
      { key: "Escape" },
    );

    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        addTags: ["client"],
        removeTags: ["devis"],
      }),
    );
  });
});

describe("détail : sous-tâches", () => {
  it("Entrée dans « Ajouter une sous-tâche » : tasks.create sous cette tâche, champ vidé", async () => {
    const task = renderDetail();
    const field = screen.getByRole("textbox", {
      name: "Ajouter une sous-tâche",
    });

    fireEvent.change(field, { target: { value: "Préparer le devis" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(paramsOf("tasks.create")).toEqual({
        title: "Préparer le devis",
        parentId: task.id,
      }),
    );
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
  });

  it("sous-tâches listées, cochables, avec lien vers leur détail", () => {
    const subtask = buildTask({ title: "Préparer le devis", parentTitle: "x" });
    renderDetail(buildDetail({ subtasks: [subtask] }));

    const list = screen.getByRole("region", { name: "Sous-tâches" });

    expect(
      within(list).getByRole("checkbox", {
        name: "Terminer « Préparer le devis »",
      }),
    ).toBeTruthy();
    expect(
      within(list)
        .getByRole("link", { name: /Préparer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${subtask.id}`);
    // La parente est la tâche ouverte : pas de légende « Sous-tâche de » dans sa propre liste.
    expect(within(list).queryByText("x")).toBeNull();
  });

  it("détail d'une sous-tâche : lien vers la parente, pas d'ajout de sous-tâche, côté et espace non modifiables", () => {
    const parentId = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    renderDetail(buildDetail({ parentId, parentTitle: "Relancer le devis" }));

    expect(
      screen
        .getByRole("link", { name: /Relancer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${parentId}`);
    expect(
      screen.queryByRole("textbox", { name: "Ajouter une sous-tâche" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /^Côté :/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Espace :/ })).toBeNull();
    expect(screen.getByText("Comme la tâche parente")).toBeTruthy();
  });
});

describe("détail : corbeille", () => {
  it("corbeille : retour à la liste, puis « Annuler » restaure la tâche", async () => {
    const task = renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(push).toHaveBeenCalledWith("/tasks", { scroll: false });
    task.leave();
    await waitFor(() =>
      expect(paramsOf("tasks.moveToTrash")).toEqual({ taskId: task.id }),
    );
    await screen.findByText("Tâche mise à la corbeille");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    await waitFor(() =>
      expect(paramsOf("tasks.restore")).toEqual({ taskId: task.id }),
    );
    expect(await screen.findByText("Tâche restaurée")).toBeTruthy();
  });

  it("message gardé tant que la liste n'est pas affichée (sur le détail encore ouvert, il serait inerte)", async () => {
    pathname.current = "/tasks/en-cours";
    const task = renderDetail();

    fireEvent.click(screen.getByRole("button", { name: "Mettre à la corbeille" }));
    await waitFor(() =>
      expect(paramsOf("tasks.moveToTrash")).toEqual({ taskId: task.id }),
    );
    await act(async () => {});
    expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull();
    pathname.current = "/tasks";
    task.leave();

    expect(await screen.findByText("Tâche mise à la corbeille")).toBeTruthy();
  });

  it("sous-tâche mise à la corbeille : retour à la liste (message et Annuler hors de toute fenêtre)", () => {
    const parentId = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    renderDetail(buildDetail({ parentId, parentTitle: "Parente" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(push).toHaveBeenCalledWith("/tasks", { scroll: false });
  });

  it("corbeille refusée : message, pas d'Annuler", async () => {
    runAppAction.mockResolvedValue({ ok: false });
    renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(
      await screen.findByText("Tâche non mise à la corbeille. Réessaie."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Annuler" })).toBeNull();
  });
});
