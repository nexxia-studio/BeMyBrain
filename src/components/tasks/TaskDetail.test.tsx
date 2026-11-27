import {
  act,
  cleanup,
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

import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_TINT_CLASSES,
} from "./priority-icons";
import { TaskDetail } from "./TaskDetail";
import { TaskTrashProvider } from "./TaskTrashProvider";

const TODAY = "2026-11-19";
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  color: "indigo",
} as const;

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
    relations: { blocks: [], blockedBy: [], related: [] },
    ...overrides,
  };
}

function tree(task: TaskDetailData | null, listQuery = "") {
  return (
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <TaskTrashProvider>
        {task !== null && (
          <TaskDetail
            // Comme TaskDetailPanel : une autre tâche, une autre instance.
            key={task.id}
            task={task}
            contexts={[TRUSTUP, NEXXIA]}
            today={TODAY}
            listQuery={listQuery}
          />
        )}
      </TaskTrashProvider>
    </NextIntlClientProvider>
  );
}

function renderDetail(task: TaskDetailData = buildDetail(), listQuery = "") {
  const { rerender } = render(tree(task, listQuery));
  return Object.assign(task, {
    /** Navigation vers la liste (router.push simulé) : le détail quitte la page, le layout reste. */
    leave: () => rerender(tree(null)),
    /** Navigation vers le détail d'une autre tâche (router.push simulé), sous le même layout. */
    show: (next: TaskDetailData) => rerender(tree(next, listQuery)),
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

describe("détail : pastilles vides", () => {
  it("la ligne nomme le champ : les pastilles disent Aucun, Sans date, Aucun", () => {
    renderDetail(buildDetail({ contextId: null, contextName: null, tags: [] }));

    expect(chip(/^Espace :/).textContent).toBe("Aucun");
    expect(chip(/^Échéance :/).textContent).toBe("Sans date");
    expect(chip(/^Tags :/).textContent).toBe("Aucun");
  });
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

  it("statut : libellés accordés avec « tâche », dans l'ordre des catégories (décision du 2026-11-20)", async () => {
    renderDetail();

    fireEvent.click(chip(/^Statut :/));
    await screen.findByRole("menuitemradio", { name: "À planifier" });

    expect(
      screen.getAllByRole("menuitemradio").map((item) => item.textContent),
    ).toEqual(["À planifier", "À faire", "En cours", "Terminée", "Annulée"]);
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

  it("statut : pastille désactivée pendant l'appel, réactivée après", async () => {
    const call = deferred<{ ok: true; result: null }>();
    runAppAction.mockReturnValue(call.promise);
    renderDetail();

    fireEvent.click(chip(/^Statut :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "En cours" }),
    );

    await waitFor(() =>
      expect((chip(/^Statut :/) as HTMLButtonElement).disabled).toBe(true),
    );
    call.resolve({ ok: true, result: null });
    await waitFor(() =>
      expect((chip(/^Statut :/) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("panne pendant le changement de statut : message générique sous le statut, pastille réactivée", async () => {
    runAppAction.mockRejectedValue(new Error("réseau"));
    renderDetail();

    fireEvent.click(chip(/^Statut :/));
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Terminée" }),
    );

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
    // La pastille reste désactivée jusqu'à la fin du premier appel (transition) : sous charge, un clic
    // envoyé avant serait ignoré et le menu ne s'ouvrirait pas. On attend, comme l'utilisateur.
    await waitFor(() =>
      expect((chip(/^Espace :/) as HTMLButtonElement).disabled).toBe(false),
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

  it("sans aucune sous-tâche : le champ est là, sur une ligne à icône « + », focus gardé après l'ajout", async () => {
    renderDetail(buildDetail({ subtasks: [] }));
    const field = screen.getByRole("textbox", {
      name: "Ajouter une sous-tâche",
    }) as HTMLInputElement;
    expect(field.placeholder).toBe("Ajouter une sous-tâche");
    expect(field.closest("form")!.querySelector("svg.lucide-plus")).not.toBe(
      null,
    );

    // La fenêtre pose son focus de départ (croix) juste après le rendu : attendu avant de focaliser le champ.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    field.focus();
    fireEvent.change(field, { target: { value: "Préparer le devis" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    await waitFor(() => expect(field.value).toBe(""));
    expect(document.activeElement).toBe(field);
  });

  it("ajout refusé par le registre : message du code sous le champ, saisie gardée", async () => {
    runAppAction.mockImplementation(async () => ({
      ok: false,
      code: "not_found",
    }));
    renderDetail();
    const field = screen.getByRole("textbox", {
      name: "Ajouter une sous-tâche",
    }) as HTMLInputElement;

    fireEvent.change(field, { target: { value: "Préparer le devis" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messages.tasks.errors.not_found);
    expect(field.value).toBe("Préparer le devis");
  });

  it("ajout en panne (action rejetée) : « Sous-tâche non ajoutée. Réessaie. »", async () => {
    runAppAction.mockRejectedValue(new Error("panne"));
    renderDetail();
    const field = screen.getByRole("textbox", {
      name: "Ajouter une sous-tâche",
    });

    fireEvent.change(field, { target: { value: "Préparer le devis" } });
    fireEvent.submit(field.closest("form") as HTMLFormElement);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messages.tasks.detail.subtasks.addFailed);
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
    expect(
      screen.getByText("Côté et espace : comme la tâche parente"),
    ).toBeTruthy();
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
    // Message posé après l'await de la transition : il peut s'afficher un rendu avant la fin de l'appel,
    // « Annuler » encore désactivé (clic ignoré). On attend, comme l'utilisateur.
    const undo = screen.getByRole("button", {
      name: "Annuler",
    }) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
    fireEvent.click(undo);

    await waitFor(() =>
      expect(paramsOf("tasks.restore")).toEqual({ taskId: task.id }),
    );
    expect(await screen.findByText("Tâche restaurée")).toBeTruthy();
  });

  it("message gardé tant que la liste n'est pas affichée (sur le détail encore ouvert, il serait inerte)", async () => {
    pathname.current = "/tasks/en-cours";
    const task = renderDetail();

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    await waitFor(() =>
      expect(paramsOf("tasks.moveToTrash")).toEqual({ taskId: task.id }),
    );
    await act(async () => {});
    expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull();
    pathname.current = "/tasks";
    task.leave();

    expect(await screen.findByText("Tâche mise à la corbeille")).toBeTruthy();
  });

  it("sous-tâche mise à la corbeille : retour au détail de sa parente, pas à la liste", () => {
    const parentId = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    renderDetail(buildDetail({ parentId, parentTitle: "Parente" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(push).toHaveBeenCalledWith(`/tasks/${parentId}`, {
      scroll: false,
    });
  });

  it("sous-tâche : message et « Annuler » dans la fenêtre du détail de la parente, « Annuler » la restaure", async () => {
    const parent = buildDetail({ title: "Parente" });
    const subtask = buildDetail({
      parentId: parent.id,
      parentTitle: "Parente",
    });
    pathname.current = `/tasks/${subtask.id}`;
    const view = renderDetail(subtask);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);

    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByText("Tâche mise à la corbeille"),
    ).toBeTruthy();
    const undo = within(dialog).getByRole("button", {
      name: "Annuler",
    }) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
    fireEvent.click(undo);

    await waitFor(() =>
      expect(paramsOf("tasks.restore")).toEqual({ taskId: subtask.id }),
    );
    expect(await within(dialog).findByText("Tâche restaurée")).toBeTruthy();
  });

  it("sous-tâche : le message s'affiche dans la région « status » posée par le détail lui-même (annonce fiable)", async () => {
    const parent = buildDetail({ title: "Parente" });
    const subtask = buildDetail({
      parentId: parent.id,
      parentTitle: "Parente",
    });
    pathname.current = `/tasks/${subtask.id}`;
    const view = renderDetail(subtask);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);

    const dialog = screen.getByRole("dialog");
    const region = within(dialog).getByTestId("detail-notice");
    expect(region.getAttribute("role")).toBe("status");
    expect(within(dialog).getAllByRole("status")).toEqual([region]);
    expect(
      await within(region).findByText("Tâche mise à la corbeille"),
    ).toBeTruthy();
  });

  it("réponse lente, page jamais quittée : message puis « Annuler » actif dans le détail de la parente", async () => {
    const call = deferred<{ ok: true; result: null }>();
    runAppAction.mockReturnValue(call.promise);
    const parent = buildDetail({ title: "Parente" });
    const subtask = buildDetail({
      parentId: parent.id,
      parentTitle: "Parente",
    });
    pathname.current = `/tasks/${subtask.id}`;
    const view = renderDetail(subtask);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);
    await act(async () => {});
    expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull();

    await act(async () => call.resolve({ ok: true, result: null }));

    const region = screen.getByTestId("detail-notice");
    expect(
      await within(region).findByText("Tâche mise à la corbeille"),
    ).toBeTruthy();
    const undo = within(region).getByRole("button", {
      name: "Annuler",
    }) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
  });

  it.each([
    ["la première répond en premier", true],
    ["la première répond en dernier", false],
  ])(
    "deux mises à la corbeille vers la même page, %s : message et « Annuler » de la seconde",
    async (_order, firstAnswersFirst) => {
      const calls = new Map<string, Deferred<{ ok: true; result: null }>>();
      runAppAction.mockImplementation(
        async (name: string, params: { taskId: string }) => {
          if (name !== "tasks.moveToTrash") return { ok: true, result: null };
          const call = deferred<{ ok: true; result: null }>();
          calls.set(params.taskId, call);
          return call.promise;
        },
      );
      const first = buildDetail({ title: "Première" });
      const second = buildDetail({ title: "Seconde" });
      const view = renderDetail(first);
      fireEvent.click(
        screen.getByRole("button", { name: "Mettre à la corbeille" }),
      );
      view.show(second);
      fireEvent.click(
        screen.getByRole("button", { name: "Mettre à la corbeille" }),
      );
      view.leave();
      await waitFor(() => expect(calls.size).toBe(2));

      const order = firstAnswersFirst ? [first, second] : [second, first];
      for (const task of order) {
        await act(async () =>
          calls.get(task.id)!.resolve({ ok: true, result: null }),
        );
      }
      const undo = (await screen.findByRole("button", {
        name: "Annuler",
      })) as HTMLButtonElement;
      await waitFor(() => expect(undo.disabled).toBe(false));
      expect(screen.getAllByText("Tâche mise à la corbeille")).toHaveLength(1);
      fireEvent.click(undo);

      await waitFor(() =>
        expect(paramsOf("tasks.restore")).toEqual({ taskId: second.id }),
      );
    },
  );

  it("première encore en attente, seconde répondue : « Annuler » actif et message effacé après 8 s", async () => {
    const calls = new Map<string, Deferred<{ ok: true; result: null }>>();
    runAppAction.mockImplementation(
      async (name: string, params: { taskId: string }) => {
        if (name !== "tasks.moveToTrash") return { ok: true, result: null };
        const call = deferred<{ ok: true; result: null }>();
        calls.set(params.taskId, call);
        return call.promise;
      },
    );
    const first = buildDetail({ title: "Première" });
    const second = buildDetail({ title: "Seconde" });
    const view = renderDetail(first);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    view.show(second);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    view.leave();
    await waitFor(() => expect(calls.size).toBe(2));
    // Minuteur seul : Motion garde ses vraies images (requestAnimationFrame) pour la sortie.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    await act(async () =>
      calls.get(second.id)!.resolve({ ok: true, result: null }),
    );
    const undo = screen.getByRole("button", {
      name: "Annuler",
    }) as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
    await act(async () => vi.advanceTimersByTime(8_000));
    vi.useRealTimers();

    await waitFor(() =>
      expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull(),
    );
  });

  it("« Annuler » dont la page est quittée pendant l'appel : « Tâche restaurée » n'apparaît pas au retour", async () => {
    const restore = deferred<{ ok: true; result: null }>();
    runAppAction.mockImplementation(async (name: string) =>
      name === "tasks.restore" ? restore.promise : { ok: true, result: null },
    );
    const task = renderDetail();
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    task.leave();
    const undo = (await screen.findByRole("button", {
      name: "Annuler",
    })) as HTMLButtonElement;
    await waitFor(() => expect(undo.disabled).toBe(false));
    fireEvent.click(undo);
    pathname.current = "/tasks/autre";
    task.show(buildDetail({ title: "Autre" }));

    await act(async () => restore.resolve({ ok: true, result: null }));
    pathname.current = "/tasks";
    task.leave();
    await act(async () => {});

    expect(screen.queryByText("Tâche restaurée")).toBeNull();
  });

  it("message arrivé après avoir quitté sa page (détail de la parente fermé pendant l'appel) : jamais affiché", async () => {
    const call = deferred<{ ok: true; result: null }>();
    runAppAction.mockReturnValue(call.promise);
    const parent = buildDetail({ title: "Parente" });
    const subtask = buildDetail({
      parentId: parent.id,
      parentTitle: "Parente",
    });
    pathname.current = `/tasks/${subtask.id}`;
    const view = renderDetail(subtask);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);
    pathname.current = "/tasks";
    view.leave();

    await act(async () => call.resolve({ ok: true, result: null }));
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);
    await act(async () => {});

    expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull();
  });

  it("message quitté (détail de la parente fermé) : il ne revient pas en rouvrant ce détail", async () => {
    const parent = buildDetail({ title: "Parente" });
    const subtask = buildDetail({
      parentId: parent.id,
      parentTitle: "Parente",
    });
    pathname.current = `/tasks/${subtask.id}`;
    const view = renderDetail(subtask);
    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);
    await screen.findByText("Tâche mise à la corbeille");

    pathname.current = "/tasks";
    view.leave();
    pathname.current = `/tasks/${parent.id}`;
    view.show(parent);

    expect(screen.queryByText("Tâche mise à la corbeille")).toBeNull();
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

describe("détail : terminées affichées (?completed=1) gardé", () => {
  const COMPLETED = "?completed=1";

  it("corbeille : retour à la liste avec les terminées", () => {
    renderDetail(buildDetail(), COMPLETED);

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(push).toHaveBeenCalledWith("/tasks?completed=1", { scroll: false });
  });

  it("corbeille : le message s'affiche sur la liste avec les terminées", async () => {
    const view = renderDetail(buildDetail(), COMPLETED);

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );
    view.leave();

    expect(await screen.findByText("Tâche mise à la corbeille")).toBeTruthy();
  });

  it("sous-tâche mise à la corbeille : retour au détail de sa parente avec les terminées", () => {
    const parentId = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    renderDetail(buildDetail({ parentId, parentTitle: "Parente" }), COMPLETED);

    fireEvent.click(
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    );

    expect(push).toHaveBeenCalledWith(`/tasks/${parentId}${COMPLETED}`, {
      scroll: false,
    });
  });

  it("lien vers une sous-tâche et vers la parente : requête gardée", () => {
    const parentId = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
    const subtask = buildTask({ title: "Préparer le devis" });
    renderDetail(buildDetail({ subtasks: [subtask] }), COMPLETED);

    expect(
      screen
        .getByRole("link", { name: /Préparer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${subtask.id}${COMPLETED}`);

    cleanup();
    renderDetail(buildDetail({ parentId, parentTitle: "Parente" }), COMPLETED);

    expect(
      screen.getByRole("link", { name: /Parente/ }).getAttribute("href"),
    ).toBe(`/tasks/${parentId}${COMPLETED}`);
  });
});

describe("détail : mise en page", () => {
  it("sans parente : la croix de fermeture est dans la rangée du libellé « Titre »", () => {
    renderDetail();

    const close = screen.getByRole("button", { name: "Fermer" });
    const row = close.parentElement!;

    expect(within(row).getByText("Titre", { selector: "label" })).toBeTruthy();
  });

  it("sous-tâche : la croix reste sur la rangée du titre, sans lien vers la parente en tête", () => {
    renderDetail(
      buildDetail({
        parentId: "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        parentTitle: "Relancer le devis",
      }),
    );

    const row = screen.getByRole("button", { name: "Fermer" }).parentElement!;

    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(row).getByRole("textbox", { name: "Titre" })).toBeTruthy();
  });

  it("sur ordinateur, le panneau démarre sous l'en-tête de la coque et s'aligne sur son bord droit", () => {
    renderDetail();

    const viewport = screen.getByRole("dialog").parentElement!;

    expect(viewport.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["lg:pt-detail-top", "lg:pr-detail-right"]),
    );
  });
});

describe("détail : priorité teintée", () => {
  it.each([
    [1, "lucide-square-exclamation-point"],
    [2, "lucide-signal-high"],
    [3, "lucide-signal-medium"],
    [4, "lucide-signal-low"],
  ] as const)(
    "niveau %i : la pastille Priorité prend l'icône du niveau sur son fond teinté, libellé à l'encre de la teinte",
    (priority, icon) => {
      renderDetail(buildDetail({ priority }));

      const trigger = chip(/^Priorité :/);
      const classes = trigger.className.split(/\s+/);

      expect(classes).toEqual(
        expect.arrayContaining(PRIORITY_TINT_CLASSES[priority].split(" ")),
      );
      expect(classes).not.toContain("bg-secondary");
      expect(classes).not.toContain("text-foreground");
      // Forme des pastilles de champ gardée (44 px, pilule).
      expect(classes).toEqual(
        expect.arrayContaining(["min-h-11", "rounded-full", "text-small"]),
      );
      const svg = trigger.querySelector(`svg.${icon}`)!;
      expect(svg.getAttribute("class")).not.toMatch(/\btext-/);
    },
  );

  it("sans priorité, la pastille reste neutre et garde l'icône du champ, sans point isolé", () => {
    renderDetail(buildDetail({ priority: 0 }));

    const trigger = chip(/^Priorité :/);

    expect(trigger.querySelector("svg.lucide-flag")).not.toBeNull();
    expect(trigger.querySelector("svg.lucide-signal-zero")).toBeNull();
    expect(trigger.className).not.toContain("priority");
    expect(trigger.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["bg-secondary", "text-foreground"]),
    );
  });

  it("le menu montre un badge teinté à icône distincte devant chaque niveau, rien devant « Aucune »", async () => {
    renderDetail();

    fireEvent.click(chip(/^Priorité :/));

    const levels = [
      ["Urgente", 1],
      ["Haute", 2],
      ["Moyenne", 3],
      ["Basse", 4],
    ] as const;
    const icons: string[] = [];
    for (const [name, level] of levels) {
      const item = await screen.findByRole("menuitemradio", { name });
      const svg = [...item.querySelectorAll("svg")].find(
        (each) => !each.classList.contains("lucide-check"),
      )!;
      icons.push(svg.getAttribute("class") ?? "");
      const badge = svg.parentElement!;
      expect(badge.className.split(/\s+/)).toEqual(
        expect.arrayContaining([
          ...PRIORITY_BADGE_CLASSES.split(" "),
          ...PRIORITY_TINT_CLASSES[level].split(" "),
        ]),
      );
      expect(badge.getAttribute("aria-hidden")).toBe("true");
      // Le libellé du menu reste à l'encre ordinaire, hors du badge.
      expect(badge.textContent).toBe("");
    }
    expect(new Set(icons).size).toBe(4);
    const none = await screen.findByRole("menuitemradio", { name: "Aucune" });
    expect(none.querySelector("svg:not(.lucide-check)")).toBeNull();
    expect(none.querySelector("[class*='bg-priority-']")).toBeNull();
  });

  it("Statut et Côté gardent la pastille ordinaire", () => {
    renderDetail();

    for (const field of [/^Statut :/, /^Côté :/]) {
      const classes = chip(field).className.split(/\s+/);
      expect(classes).toEqual(
        expect.arrayContaining(["bg-secondary", "text-foreground"]),
      );
      expect(chip(field).className).not.toContain("priority");
    }
  });
});

/** `a` est avant `b` dans le document. */
function precedes(a: Element, b: Element) {
  return Boolean(
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("détail : hiérarchie (BRAIN-46, D9)", () => {
  it("ordre : titre, propriétés, sous-tâches, notes, corbeille", () => {
    renderDetail();

    const blocks = [
      titleField(),
      screen.getByRole("group", { name: "Propriétés" }),
      screen.getByRole("heading", { name: "Sous-tâches" }),
      screen.getByRole("textbox", { name: "Notes" }),
      screen.getByRole("button", { name: "Mettre à la corbeille" }),
    ];

    blocks.slice(1).forEach((block, index) => {
      expect(precedes(blocks[index], block)).toBe(true);
    });
  });

  it("propriétés groupées : Statut, Priorité, Échéance, Côté et espace, Tags, dans cet ordre", () => {
    renderDetail();

    const names = within(screen.getByRole("group", { name: "Propriétés" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label")?.split(" :")[0]);

    expect(names).toEqual([
      "Statut",
      "Priorité",
      "Échéance",
      "Côté",
      "Espace",
      "Tags",
      "Tâche parente",
    ]);
  });

  it("sous-tâche : même ordre sans bloc sous-tâches, la parente mentionnée une seule fois, dans les propriétés", () => {
    renderDetail(
      buildDetail({
        parentId: "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
        parentTitle: "Relancer le devis",
      }),
    );

    const properties = screen.getByRole("group", { name: "Propriétés" });

    expect(
      within(properties).getByRole("link", { name: /Relancer le devis/ }),
    ).toBeTruthy();
    expect(
      within(properties).getByText("Côté et espace : comme la tâche parente"),
    ).toBeTruthy();
    // Une seule mention : plus de lien vers la parente en tête, plus de ligne « Côté et espace ».
    expect(
      screen.getAllByRole("link", { name: /Relancer le devis/ }),
    ).toHaveLength(1);
    expect(within(properties).queryByText("Côté et espace")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sous-tâches" })).toBeNull();
    expect(precedes(titleField(), properties)).toBe(true);
    expect(
      precedes(properties, screen.getByRole("textbox", { name: "Notes" })),
    ).toBe(true);
  });

  it("notes vides : repliées sur une ligne, invite « Ajouter une note »", () => {
    renderDetail(buildDetail({ notes: null }));

    const notes = screen.getByRole("textbox", {
      name: "Notes",
    }) as HTMLTextAreaElement;

    expect(notes.getAttribute("data-collapsed")).toBe("true");
    expect(notes.placeholder).toBe("Ajouter une note");
  });

  it("notes remplies : dépliées", () => {
    renderDetail();

    const notes = screen.getByRole("textbox", { name: "Notes" });

    expect(notes.getAttribute("data-collapsed")).toBe("false");
  });

  it("notes saisies dans le champ replié puis quittées : tasks.update, champ désactivé pendant l'appel", async () => {
    const pending = deferred<{ ok: true; result: null }>();
    runAppAction.mockReturnValueOnce(pending.promise);
    const task = renderDetail(buildDetail({ notes: null }));
    const notes = screen.getByRole("textbox", {
      name: "Notes",
    }) as HTMLTextAreaElement;

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "Penser au devis" } });
    fireEvent.blur(notes);

    await waitFor(() => expect(notes.disabled).toBe(true));
    expect(paramsOf("tasks.update")).toEqual({
      taskId: task.id,
      notes: "Penser au devis",
    });
    await act(async () => pending.resolve({ ok: true, result: null }));
    expect(notes.disabled).toBe(false);
  });

  it("notes vides remplacées par des retours à la ligne : aucun appel, saisie gardée, champ non rétréci", async () => {
    renderDetail(buildDetail({ notes: null }));
    const notes = screen.getByRole("textbox", { name: "Notes" });

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "\n\n\n\n" } });
    fireEvent.blur(notes);

    await act(async () => {});
    expect(runAppAction).toHaveBeenCalledTimes(0);
    expect((notes as HTMLTextAreaElement).value).toBe("\n\n\n\n");
    expect(notes.getAttribute("data-collapsed")).toBe("false");
  });

  it("notes remplies puis réduites à des retours à la ligne : un seul appel, notes à null", async () => {
    const task = renderDetail(buildDetail({ notes: "Penser au devis" }));
    const notes = screen.getByRole("textbox", { name: "Notes" });

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "\n\n" } });
    fireEvent.blur(notes);

    await waitFor(() => expect(runAppAction).toHaveBeenCalledTimes(1));
    expect(paramsOf("tasks.update")).toEqual({ taskId: task.id, notes: null });
  });

  it("notes vides focalisées puis quittées : restent dépliées (la corbeille ne bouge pas sous le clic), rien d'enregistré", () => {
    renderDetail(buildDetail({ notes: null }));
    const notes = screen.getByRole("textbox", { name: "Notes" });

    fireEvent.focus(notes);
    fireEvent.blur(notes);

    expect(notes.getAttribute("data-collapsed")).toBe("false");
    expect(paramsOf("tasks.update")).toBeUndefined();
  });

  it("espaces seuls saisis puis champ quitté : le champ redevient vide, rien d'enregistré", () => {
    renderDetail(buildDetail({ notes: null }));
    const notes = screen.getByRole("textbox", {
      name: "Notes",
    }) as HTMLTextAreaElement;

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "   " } });
    fireEvent.blur(notes);

    expect(notes.value).toBe("");
    expect(paramsOf("tasks.update")).toBeUndefined();
  });

  it("notes remplacées par des espaces puis quittées : enregistrées comme absentes (null), champ vide", async () => {
    const task = renderDetail();
    const notes = screen.getByRole("textbox", {
      name: "Notes",
    }) as HTMLTextAreaElement;

    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: "   " } });
    fireEvent.blur(notes);

    expect(notes.value).toBe("");
    await waitFor(() =>
      expect(paramsOf("tasks.update")).toEqual({
        taskId: task.id,
        notes: null,
      }),
    );
  });
});

describe("détail : icônes de statut (BRAIN-46, D9)", () => {
  const STATUS_ICON = {
    backlog: "lucide-circle-dashed",
    unstarted: "lucide-circle",
    started: "lucide-circle-dot",
    completed: "lucide-circle-check",
    canceled: "lucide-circle-x",
  } as const;

  it.each(Object.entries(STATUS_ICON))(
    "la pastille Statut d'une tâche « %s » montre son icône",
    (statusCategory, icon) => {
      renderDetail(
        buildDetail({
          statusCategory: statusCategory as keyof typeof STATUS_ICON,
        }),
      );

      const svg = chip(/^Statut :/).querySelector("svg")!;

      expect(svg.classList.contains(icon)).toBe(true);
    },
  );

  it("le menu montre une icône distincte par statut", async () => {
    renderDetail();

    fireEvent.click(chip(/^Statut :/));

    const items = await screen.findAllByRole("menuitemradio");
    // La coche du choix courant porte la classe exacte `lucide-check` (« Terminée » : `lucide-circle-check`).
    const icons = items.map((item) =>
      [...item.querySelectorAll("svg")]
        .find((svg) => !svg.classList.contains("lucide-check"))
        ?.getAttribute("class"),
    );
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(5);
  });

  it("couleur : indigo pour En cours et Terminée, encre secondaire pour À planifier et Annulée, jamais la braise", () => {
    const tone = (statusCategory: keyof typeof STATUS_ICON) => {
      cleanup();
      renderDetail(buildDetail({ statusCategory }));
      return chip(/^Statut :/).querySelector("svg")!.classList;
    };

    expect(tone("started").contains("text-link")).toBe(true);
    expect(tone("completed").contains("text-link")).toBe(true);
    expect(tone("backlog").contains("text-muted-foreground")).toBe(true);
    expect(tone("canceled").contains("text-muted-foreground")).toBe(true);
    expect(tone("canceled").contains("text-destructive")).toBe(false);
  });
});
