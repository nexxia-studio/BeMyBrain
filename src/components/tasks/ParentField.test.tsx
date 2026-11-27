import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import { ParentField } from "./ParentField";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";

// `tasks.list` sert les candidates ; `tasks.setParent` répond `setParent`.
function serve(candidates: Task[], setParent: unknown = { ok: true }) {
  runAppAction.mockImplementation(async (name: string) => {
    if (name === "tasks.list")
      return { ok: true, result: { tasks: candidates, truncated: false } };
    return setParent;
  });
}

type FieldProps = Parameters<typeof ParentField>[0];

function field(props: Partial<FieldProps>) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ParentField
        taskId={TASK_ID}
        side="pro"
        parentId={null}
        parentTitle={null}
        hasSubtasks={false}
        listQuery=""
        {...props}
      />
    </NextIntlClientProvider>
  );
}

// Renvoie de quoi simuler le nouveau rendu serveur (nouvelle `parentId` en prop).
function renderField(props: Partial<FieldProps> = {}) {
  const { rerender } = render(field(props));
  return (next: Partial<FieldProps>) => rerender(field(next));
}

const setParentCalls = () =>
  runAppAction.mock.calls.filter(([name]) => name === "tasks.setParent");

beforeEach(() => runAppAction.mockReset());
afterEach(cleanup);

describe("propriété « Tâche parente »", () => {
  it("rattacher : la liste ne propose que des premiers niveaux, choisir appelle tasks.setParent", async () => {
    const candidate = buildTask({ title: "Dossier Nexxia", side: "pro" });
    serve([candidate]);
    renderField();

    fireEvent.click(
      screen.getByRole("button", { name: "Tâche parente : Aucune" }),
    );
    fireEvent.click(await screen.findByText("Dossier Nexxia"));

    await waitFor(() => expect(setParentCalls()).toHaveLength(1));
    expect(setParentCalls()[0]).toEqual([
      "tasks.setParent",
      { taskId: TASK_ID, parentId: candidate.id },
    ]);
    const listCall = runAppAction.mock.calls.find(
      ([name]) => name === "tasks.list",
    );
    expect(listCall?.[1]).toMatchObject({ side: "pro", topLevelOnly: true });
  });

  it("Échap ferme la liste sans écrire et rend le focus au bouton", async () => {
    serve([buildTask({ title: "Dossier" })]);
    renderField();
    const trigger = screen.getByRole("button", {
      name: "Tâche parente : Aucune",
    });
    fireEvent.click(trigger);
    const field = await screen.findByRole("combobox", {
      name: "Chercher une tâche",
    });

    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(setParentCalls()).toHaveLength(0);
  });

  it("avec une parente : lien vers elle, « Détacher » envoie parentId null", async () => {
    serve([]);
    renderField({ parentId: PARENT_ID, parentTitle: "Relancer le devis" });

    expect(
      screen
        .getByRole("link", { name: /Relancer le devis/ })
        .getAttribute("href"),
    ).toBe(`/tasks/${PARENT_ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Détacher" }));

    await waitFor(() => expect(setParentCalls()).toHaveLength(1));
    expect(setParentCalls()[0]?.[1]).toEqual({
      taskId: TASK_ID,
      parentId: null,
    });
  });

  it("après avoir rattaché, le focus passe à « Changer » (le bouton « Aucune » est démonté)", async () => {
    const candidate = buildTask({ title: "Dossier" });
    serve([candidate]);
    const rerender = renderField();
    fireEvent.click(
      screen.getByRole("button", { name: "Tâche parente : Aucune" }),
    );
    fireEvent.click(await screen.findByText("Dossier"));
    await waitFor(() => expect(setParentCalls()).toHaveLength(1));

    await act(async () =>
      rerender({ parentId: candidate.id, parentTitle: "Dossier" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Changer" }),
    );
  });

  it("après « Détacher », le focus passe à « Aucune » (le bouton « Détacher » est démonté)", async () => {
    serve([]);
    const rerender = renderField({
      parentId: PARENT_ID,
      parentTitle: "Relancer le devis",
    });
    fireEvent.click(screen.getByRole("button", { name: "Détacher" }));
    await waitFor(() => expect(setParentCalls()).toHaveLength(1));

    await act(async () => rerender({ parentId: null, parentTitle: null }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Tâche parente : Aucune" }),
    );
  });

  it("changer de parente : une seule écriture, l'ancienne parente n'est pas proposée", async () => {
    const other = buildTask({ title: "Autre dossier" });
    serve([other]);
    renderField({ parentId: PARENT_ID, parentTitle: "Relancer le devis" });

    fireEvent.click(screen.getByRole("button", { name: "Changer" }));
    fireEvent.click(await screen.findByText("Autre dossier"));

    await waitFor(() => expect(setParentCalls()).toHaveLength(1));
    expect(setParentCalls()[0]?.[1]).toEqual({
      taskId: TASK_ID,
      parentId: other.id,
    });
  });

  it("désactivée avec la raison quand la tâche a des sous-tâches", () => {
    serve([]);
    renderField({ hasSubtasks: true });

    expect(
      screen.getByText(messages.tasks.detail.parentField.hasSubtasks),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Tâche parente/ })).toBeNull();
    expect(runAppAction).not.toHaveBeenCalled();
  });

  it.each([
    "subtask_depth",
    "cross_side_parent",
    "has_subtasks",
    "has_trashed_subtasks",
    "parent_in_trash",
    "not_found",
  ] as const)("refus %s traduit sous le champ", async (code) => {
    const candidate = buildTask({ title: "Dossier" });
    serve([candidate], { ok: false, code });
    renderField();

    fireEvent.click(
      screen.getByRole("button", { name: "Tâche parente : Aucune" }),
    );
    fireEvent.click(await screen.findByText("Dossier"));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(messages.tasks.errors[code]);
  });

  it("échec sans code : message générique", async () => {
    serve([buildTask({ title: "Dossier" })], { ok: false });
    renderField();

    fireEvent.click(
      screen.getByRole("button", { name: "Tâche parente : Aucune" }),
    );
    fireEvent.click(await screen.findByText("Dossier"));

    expect((await screen.findByRole("alert")).textContent).toBe(
      messages.tasks.detail.updateFailed,
    );
  });
});
