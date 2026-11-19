import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../messages/fr.json";
import type { QuickAddScope } from "../quick-add/quick-add-types";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

import { TaskQuickAddForm } from "./TaskQuickAddForm";

const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };
const TASK_ID = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

const PRO_TRUSTUP: QuickAddScope = {
  side: "pro",
  contexts: [TRUSTUP, NEXXIA],
  contextId: TRUSTUP.id,
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function renderForm(scope: QuickAddScope = PRO_TRUSTUP, onClose = vi.fn()) {
  const initialFocusRef = createRef<HTMLInputElement>();
  render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <TaskQuickAddForm
        scope={scope}
        initialFocusRef={initialFocusRef}
        onClose={onClose}
      />
    </NextIntlClientProvider>,
  );
  return { initialFocusRef, onClose };
}

const title = () => screen.getByRole("textbox", { name: "Tâche" });
const submit = () => screen.getByRole("button", { name: /^Ajout/ });
const contextChip = () => screen.getByRole("button", { name: /^Espace :/ });
const dateChip = () => screen.getByRole("button", { name: /^Échéance :/ });
const tagsChip = () => screen.getByRole("button", { name: /^Tags :/ });

/** Entrée dans le titre : envoi du formulaire. */
const form = () => title().closest("form") as HTMLFormElement;

function typeTitle(value: string) {
  fireEvent.change(title(), { target: { value } });
}

/** Paramètres du dernier appel à `tasks.create`. */
function createParams(): Record<string, unknown> {
  const call = runAppAction.mock.calls.findLast(
    ([name]) => name === "tasks.create",
  );
  return call?.[1] as Record<string, unknown>;
}

async function openTags() {
  fireEvent.click(tagsChip());
  return screen.findByRole("textbox", { name: "Chercher ou créer un tag" });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Jeudi 19 novembre 2026, 11:00 à Bruxelles.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
  runAppAction.mockImplementation(async (name: string) =>
    name === "tasks.listTags"
      ? { ok: true, result: [{ id: "t1", name: "client" }] }
      : { ok: true, result: { id: TASK_ID } },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ajout rapide : formulaire tâche", () => {
  it("titre seul → création avec le côté et l'espace courants, sans date ni tags", async () => {
    renderForm();

    typeTitle("Relancer le devis");
    fireEvent.click(submit());

    await waitFor(() =>
      expect(createParams()).toEqual({
        title: "Relancer le devis",
        side: "pro",
        context: "Trustup",
      }),
    );
  });

  it("aucun espace filtré : création sur le côté actif, sans espace", async () => {
    renderForm({ side: "private", contexts: [], contextId: null });

    typeTitle("Acheter des ampoules");
    fireEvent.submit(form());

    await waitFor(() =>
      expect(createParams()).toEqual({
        title: "Acheter des ampoules",
        side: "private",
      }),
    );
  });

  it("sans espace sur le côté : pas de pastille Espace", () => {
    renderForm({ side: "private", contexts: [], contextId: null });

    expect(screen.queryByRole("button", { name: /^Espace :/ })).toBeNull();
  });

  it("espace, date et tag choisis chacun en un tap", async () => {
    renderForm();
    typeTitle("Relancer le devis");

    fireEvent.click(contextChip());
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "Nexxia" }),
    );
    fireEvent.click(dateChip());
    fireEvent.click(await screen.findByRole("button", { name: /^Demain/ }));
    await openTags();
    fireEvent.click(await screen.findByRole("button", { name: "client" }));
    fireEvent.click(submit());

    await waitFor(() =>
      expect(createParams()).toEqual({
        title: "Relancer le devis",
        side: "pro",
        context: "Nexxia",
        dueDate: "2026-11-20",
        tags: ["client"],
      }),
    );
  });

  it("raccourcis de date : ce week-end = samedi qui suit, semaine prochaine = lundi", async () => {
    renderForm();
    typeTitle("Tondre");

    fireEvent.click(dateChip());
    fireEvent.click(
      await screen.findByRole("button", { name: /^Ce week-end/ }),
    );

    expect(dateChip().textContent).toContain("Ce week-end");
    fireEvent.click(dateChip());
    fireEvent.click(
      await screen.findByRole("button", { name: /^Semaine prochaine/ }),
    );
    fireEvent.click(submit());
    await waitFor(() =>
      expect(createParams()).toMatchObject({ dueDate: "2026-11-23" }),
    );
  });

  it("Choisir… une date puis ajouter une heure", async () => {
    renderForm();
    typeTitle("Dentiste");

    fireEvent.click(dateChip());
    fireEvent.change(await screen.findByLabelText("Choisir…"), {
      target: { value: "2026-12-03" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une heure" }));
    fireEvent.change(screen.getByLabelText("Heure"), {
      target: { value: "14:30" },
    });
    fireEvent.click(submit());

    await waitFor(() =>
      expect(createParams()).toMatchObject({
        dueDate: "2026-12-03",
        dueTime: "14:30",
      }),
    );
  });

  it("tag inconnu tapé → « Créer « … » » l'ajoute", async () => {
    renderForm();
    typeTitle("Relancer le devis");

    const search = await openTags();
    fireEvent.change(search, { target: { value: "Devis 2027" } });
    fireEvent.click(
      await screen.findByRole("button", { name: "Créer « Devis 2027 »" }),
    );
    fireEvent.click(submit());

    await waitFor(() =>
      expect(createParams()).toMatchObject({ tags: ["Devis 2027"] }),
    );
  });

  it("tag existant tapé dans une autre casse : pas de création, le tag existant est proposé", async () => {
    renderForm();

    const search = await openTags();
    fireEvent.change(search, { target: { value: "CLIENT" } });

    expect(await screen.findByRole("button", { name: "client" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Créer/ })).toBeNull();
  });

  it("tags non chargés : message, création toujours possible", async () => {
    runAppAction.mockImplementation(async (name: string) =>
      name === "tasks.listTags" ? { ok: false } : { ok: true, result: {} },
    );
    renderForm();

    const search = await openTags();
    fireEvent.change(search, { target: { value: "client" } });

    expect(
      await screen.findByText("Tags non chargés. Tu peux en créer."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Créer « client »" }),
    ).toBeTruthy();
  });

  it("succès : titre, date et tags vidés, espace gardé, focus au titre, message avec lien Ouvrir", async () => {
    const { initialFocusRef } = renderForm();
    typeTitle("Relancer le devis");
    fireEvent.click(dateChip());
    fireEvent.click(await screen.findByRole("button", { name: /^Demain/ }));
    const search = await openTags();
    fireEvent.change(search, { target: { value: "devis" } });
    fireEvent.click(
      await screen.findByRole("button", { name: "Créer « devis »" }),
    );
    fireEvent.keyDown(search, { key: "Escape" });

    fireEvent.click(submit());

    const status = await screen.findByTestId("quick-add-status");
    await waitFor(() => expect(status.textContent).toContain("Tâche ajoutée"));
    expect(
      within(status).getByRole("link", { name: "Ouvrir" }).getAttribute("href"),
    ).toBe(`/tasks/${TASK_ID}`);
    expect((title() as HTMLInputElement).value).toBe("");
    expect(dateChip().getAttribute("aria-label")).toBe("Échéance : Sans date");
    expect(tagsChip().getAttribute("aria-label")).toBe("Tags : aucun");
    expect(contextChip().getAttribute("aria-label")).toBe("Espace : Trustup");
    expect(document.activeElement).toBe(title());
    expect(initialFocusRef.current).toBe(title());
  });

  it("après un succès, les tags sont relus : un tag créé à l'ajout précédent n'est plus proposé en Créer", async () => {
    const known = [{ id: "t1", name: "client" }];
    runAppAction.mockImplementation(
      async (name: string, params: { tags?: string[] }) => {
        if (name === "tasks.listTags") return { ok: true, result: [...known] };
        for (const tag of params.tags ?? [])
          known.push({ id: `t${known.length + 1}`, name: tag });
        return { ok: true, result: { id: TASK_ID } };
      },
    );
    renderForm();
    typeTitle("Relancer le devis");
    let search = await openTags();
    fireEvent.change(search, { target: { value: "devis" } });
    fireEvent.click(
      await screen.findByRole("button", { name: "Créer « devis »" }),
    );
    fireEvent.keyDown(search, { key: "Escape" });
    fireEvent.click(submit());
    await screen.findByRole("link", { name: "Ouvrir" });

    search = await openTags();
    fireEvent.change(search, { target: { value: "devis" } });

    expect(await screen.findByRole("button", { name: "devis" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Créer/ })).toBeNull();
  });

  it("lien Ouvrir : ferme l'ajout rapide", async () => {
    const { onClose } = renderForm();
    typeTitle("Relancer le devis");
    fireEvent.click(submit());

    fireEvent.click(await screen.findByRole("link", { name: "Ouvrir" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("refus traduit : saisie conservée, message du code", async () => {
    runAppAction.mockResolvedValue({ ok: false, code: "context_not_found" });
    renderForm();
    typeTitle("Relancer le devis");

    fireEvent.click(submit());

    const status = await screen.findByTestId("quick-add-status");
    await waitFor(() => expect(status.textContent).toBe("Espace introuvable."));
    expect((title() as HTMLInputElement).value).toBe("Relancer le devis");
  });

  it("panne (appel rejeté) : saisie conservée, message générique", async () => {
    runAppAction.mockRejectedValue(new Error("réseau"));
    renderForm();
    typeTitle("Relancer le devis");

    fireEvent.click(submit());

    const status = await screen.findByTestId("quick-add-status");
    await waitFor(() =>
      expect(status.textContent).toBe("Tâche non ajoutée. Réessaie."),
    );
    expect((title() as HTMLInputElement).value).toBe("Relancer le devis");
  });

  it("bouton désactivé tant que le titre est vide ou blanc", () => {
    renderForm();

    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    typeTitle("   ");
    expect((submit() as HTMLButtonElement).disabled).toBe(true);
    typeTitle("Relancer");
    expect((submit() as HTMLButtonElement).disabled).toBe(false);
  });

  it("bouton désactivé pendant l'appel, un seul envoi", async () => {
    const pending = deferred<unknown>();
    runAppAction.mockReturnValue(pending.promise);
    renderForm();
    typeTitle("Relancer le devis");

    fireEvent.click(submit());
    await waitFor(() =>
      expect((submit() as HTMLButtonElement).disabled).toBe(true),
    );
    fireEvent.submit(form());

    expect(runAppAction).toHaveBeenCalledTimes(1);
    expect(submit().textContent).toBe("Ajout…");
    await act(async () =>
      pending.resolve({ ok: true, result: { id: TASK_ID } }),
    );
    await waitFor(() => expect((title() as HTMLInputElement).value).toBe(""));
  });
});
