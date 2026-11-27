import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TaskRelationItem, TaskRelations } from "@/modules/tasks/queries";

import messages from "../../../messages/fr.json";
import { buildTask } from "../../../tests/factories/build-task";

const runAppAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction }));

const reveal = vi.hoisted(() => vi.fn());
vi.mock("./reveal-in-scroll-parent", () => ({ revealInScrollParent: reveal }));

import { RelationList } from "./RelationList";

const TASK_ID = "11111111-1111-4111-8111-111111111111";

function item(title: string, overrides: Partial<TaskRelationItem> = {}) {
  return {
    id: buildTask().id,
    title,
    statusCategory: "unstarted",
    contextName: null,
    contextColor: null,
    ...overrides,
  } satisfies TaskRelationItem;
}

const none: TaskRelations = { blocks: [], blockedBy: [], related: [] };

function serve(
  candidates: ReturnType<typeof buildTask>[],
  write: unknown = { ok: true },
) {
  runAppAction.mockImplementation(async (name: string) => {
    if (name === "tasks.list")
      return { ok: true, result: { tasks: candidates, truncated: false } };
    return write;
  });
}

function renderList(relations: TaskRelations = none, listQuery = "") {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <RelationList
        taskId={TASK_ID}
        side="pro"
        relations={relations}
        listQuery={listQuery}
      />
    </NextIntlClientProvider>,
  );
}

const writes = (name: string) =>
  runAppAction.mock.calls.filter(([n]) => n === name);

// `mockClear`, pas `mockReset` : avec `mockReset`, un `mockRejectedValue` posé ensuite fait échouer le test
// même quand l'appel est attrapé. Chaque test pose son implémentation (`serve`).
beforeEach(() => {
  runAppAction.mockClear();
  reveal.mockClear();
});
afterEach(cleanup);

describe("section « Relations » du détail", () => {
  it("vide : seule la ligne d'ajout, aucun groupe", () => {
    serve([]);
    renderList();

    expect(
      screen.getByRole("button", { name: "Ajouter une relation" }),
    ).not.toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(runAppAction).not.toHaveBeenCalled();
  });

  it("groupes non vides seulement, chaque relation est un lien avec son statut", () => {
    const blocker = item("Valider le devis", { statusCategory: "started" });
    serve([]);
    renderList({ ...none, blockedBy: [blocker] }, "?completed=1");

    expect(
      screen.getByRole("heading", { level: 3, name: "Bloquée par" }),
    ).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Bloque" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Liée à" })).toBeNull();
    const link = screen.getByRole("link", { name: /Valider le devis/ });
    expect(link.getAttribute("href")).toBe(`/tasks/${blocker.id}?completed=1`);
    expect(within(link).getByRole("img", { name: "En cours" })).not.toBeNull();
  });

  it("ajouter « Bloquée par » : type, puis tâche, appelle tasks.addRelation avec blocked_by", async () => {
    const candidate = buildTask({ title: "Obtenir l'accord", side: "pro" });
    serve([candidate]);
    renderList();

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une relation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Bloquée par" }));
    const field = await screen.findByRole("combobox", {
      name: "Chercher une tâche",
    });
    expect(document.activeElement).toBe(field);
    fireEvent.click(await screen.findByText("Obtenir l'accord"));

    await waitFor(() => expect(writes("tasks.addRelation")).toHaveLength(1));
    expect(writes("tasks.addRelation")[0]).toEqual([
      "tasks.addRelation",
      { taskId: TASK_ID, kind: "blocked_by", otherTaskId: candidate.id },
    ]);
    const list = runAppAction.mock.calls.find(([n]) => n === "tasks.list");
    expect(list?.[1]).toMatchObject({ side: "pro" });
  });

  it("la liste ne propose pas les tâches déjà reliées par ce type, ni la tâche", async () => {
    const already = item("Déjà bloquante");
    const free = buildTask({ title: "Libre" });
    serve([free]);
    renderList({ ...none, blockedBy: [already] });

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une relation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Bloquée par" }));
    await screen.findByText("Libre");

    // Les exclusions : la tâche ouverte et celles déjà reliées par ce type (relues par la liste).
    serve([buildTask({ id: already.id, title: "Déjà bloquante" }), free]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l" } });
    const listbox = screen.getByRole("listbox");
    await waitFor(() =>
      expect(within(listbox).queryByText("Déjà bloquante")).toBeNull(),
    );
  });

  it("changer de type relit la liste avec les nouvelles exclusions", async () => {
    const already = item("Déjà bloquante");
    const alreadyTask = buildTask({ id: already.id, title: "Déjà bloquante" });
    const free = buildTask({ title: "Libre" });
    serve([alreadyTask, free]);
    renderList({ ...none, blockedBy: [already] });

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une relation" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Bloquée par" }));
    await screen.findByText("Libre");
    expect(
      within(screen.getByRole("listbox")).queryByText("Déjà bloquante"),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Liée à" }));

    const listbox = screen.getByRole("listbox");
    expect(await within(listbox).findByText("Déjà bloquante")).not.toBeNull();
  });

  it("Échap au choix du type ferme l'ajout et rend le focus au bouton", () => {
    serve([]);
    renderList();
    const add = screen.getByRole("button", { name: "Ajouter une relation" });
    fireEvent.click(add);
    const group = screen.getByRole("group", {
      name: messages.tasks.detail.relations.kindPrompt,
    });

    fireEvent.keyDown(group, { key: "Escape" });

    expect(
      screen.queryByRole("group", {
        name: messages.tasks.detail.relations.kindPrompt,
      }),
    ).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it("Échap ferme sans écrire et rend le focus au bouton d'ajout", async () => {
    serve([buildTask({ title: "X" })]);
    renderList();
    const add = screen.getByRole("button", { name: "Ajouter une relation" });
    fireEvent.click(add);
    fireEvent.click(screen.getByRole("button", { name: "Liée à" }));
    const field = await screen.findByRole("combobox");

    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(document.activeElement).toBe(add);
    expect(writes("tasks.addRelation")).toHaveLength(0);
  });

  it("« Retirer » est un bouton texte discret de 44 px, pas une pastille pleine", () => {
    serve([]);
    renderList({ ...none, related: [item("Livrer le site")] });

    const remove = screen.getByRole("button", {
      name: "Retirer la relation avec Livrer le site",
    });

    expect(remove.className).toContain("text-link");
    expect(remove.className).toContain("min-h-11");
    expect(remove.className).not.toContain("bg-secondary");
    expect(remove.className).not.toContain("rounded-full");
  });

  it("l'ajout se met dans le champ de vision à l'ouverture du panneau", () => {
    serve([]);
    renderList();

    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter une relation" }),
    );

    expect(reveal).toHaveBeenCalledTimes(1);
    expect(reveal.mock.calls[0]?.[0]).toBeInstanceOf(HTMLElement);
  });

  it("une relation affichée inversée chez l'autre : « Bloque » retire avec kind blocks", async () => {
    const blocked = item("Livrer le site");
    serve([]);
    renderList({ ...none, blocks: [blocked] });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retirer la relation avec Livrer le site",
      }),
    );

    await waitFor(() => expect(writes("tasks.removeRelation")).toHaveLength(1));
    expect(writes("tasks.removeRelation")[0]).toEqual([
      "tasks.removeRelation",
      { taskId: TASK_ID, kind: "blocks", otherTaskId: blocked.id },
    ]);
  });

  it.each([
    ["blockedBy", "blocked_by"],
    ["related", "related"],
  ] as const)(
    "retirer dans le groupe %s envoie kind %s",
    async (group, kind) => {
      const other = item("Autre");
      serve([]);
      renderList({ ...none, [group]: [other] });

      fireEvent.click(
        screen.getByRole("button", { name: "Retirer la relation avec Autre" }),
      );

      await waitFor(() =>
        expect(writes("tasks.removeRelation")).toHaveLength(1),
      );
      expect(writes("tasks.removeRelation")[0]?.[1]).toEqual({
        taskId: TASK_ID,
        kind,
        otherTaskId: other.id,
      });
    },
  );

  it.each(["relation_conflict", "cross_side_relation"])(
    "refus %s traduit sous le champ",
    async (code) => {
      const candidate = buildTask({ title: "Cible" });
      serve([candidate], { ok: false, code });
      renderList();

      fireEvent.click(
        screen.getByRole("button", { name: "Ajouter une relation" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Bloque" }));
      fireEvent.click(await screen.findByText("Cible"));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBe(
        messages.tasks.errors[code as "relation_conflict"],
      );
    },
  );

  it("échec réseau : message générique, pas de silence", async () => {
    runAppAction.mockRejectedValueOnce(new Error("réseau"));
    renderList({ ...none, related: [item("Liée")] });

    fireEvent.click(
      screen.getByRole("button", { name: "Retirer la relation avec Liée" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      messages.tasks.detail.relations.removeFailed,
    );
  });
});
