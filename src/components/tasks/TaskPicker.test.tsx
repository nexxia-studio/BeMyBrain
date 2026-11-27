import {
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

import { TaskPicker } from "./TaskPicker";

const OPEN = ["backlog", "unstarted", "started"];

// Simule `tasks.list` : filtre par titre et par catégorie de statut, dans l'ordre donné.
function serve(all: Task[]) {
  runAppAction.mockImplementation(async (_name: string, params: unknown) => {
    const p = params as {
      query?: string;
      statusCategories?: string[];
      limit?: number;
    };
    const found = all.filter(
      (t) =>
        (p.statusCategories ?? OPEN).includes(t.statusCategory) &&
        (p.query === undefined ||
          t.title.toLowerCase().includes(p.query.toLowerCase())),
    );
    return { ok: true, result: { tasks: found, truncated: false } };
  });
}

function renderPicker(props: Partial<Parameters<typeof TaskPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const onCancel = vi.fn();
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <TaskPicker
        side="pro"
        excludeIds={[]}
        onSelect={onSelect}
        onCancel={onCancel}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onSelect, onCancel };
}

const input = () =>
  screen.getByRole("combobox", { name: "Chercher une tâche" });

beforeEach(() => {
  runAppAction.mockReset();
});
afterEach(cleanup);

describe("liste de sélection de tâche", () => {
  it("se met dans le champ de vision à l'ouverture et quand les résultats arrivent, sans toucher au focus", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    serve([buildTask({ title: "Devis Trustup" })]);
    renderPicker();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    const before = scrollIntoView.mock.calls.length;
    await screen.findByText("Devis Trustup");

    expect(scrollIntoView.mock.calls.length).toBeGreaterThan(before);
  });

  it("ouverte sans recherche : tâches ouvertes du côté demandé, une seule lecture, titre + statut + espace", async () => {
    serve([
      buildTask({
        title: "Devis Trustup",
        contextName: "Trustup",
        contextColor: "warm",
      }),
      buildTask({ title: "Déjà fait", statusCategory: "completed" }),
    ]);
    renderPicker();

    expect(await screen.findByText("Devis Trustup")).not.toBeNull();
    expect(screen.queryByText("Déjà fait")).toBeNull();
    expect(screen.getByText("Trustup")).not.toBeNull();
    expect(screen.getByLabelText("À faire")).not.toBeNull();
    expect(runAppAction).toHaveBeenCalledTimes(1);
    expect(runAppAction).toHaveBeenCalledWith(
      "tasks.list",
      expect.objectContaining({ side: "pro", limit: expect.any(Number) }),
    );
  });

  it("filtre par titre avec délai, ouvertes d'abord puis closes, 20 au plus", async () => {
    const open = Array.from({ length: 3 }, (_, i) =>
      buildTask({ title: `Dossier ouvert ${i}` }),
    );
    serve([
      buildTask({ title: "Dossier clos", statusCategory: "completed" }),
      ...open,
    ]);
    renderPicker();
    await screen.findByText("Dossier ouvert 0");
    runAppAction.mockClear();

    fireEvent.change(input(), { target: { value: "dossier" } });
    expect(runAppAction).not.toHaveBeenCalled(); // délai

    await screen.findByText("Dossier clos");
    const titles = screen
      .getAllByRole("option")
      .map((o) => o.textContent ?? "");
    expect(titles[0]).toContain("Dossier ouvert 0");
    expect(titles[3]).toContain("Dossier clos");
    expect(runAppAction).toHaveBeenCalledTimes(2);
    expect(runAppAction.mock.calls[0]?.[1]).toMatchObject({
      query: "dossier",
      side: "pro",
    });
    expect(runAppAction.mock.calls[1]?.[1]).toMatchObject({
      query: "dossier",
      statusCategories: ["completed", "canceled"],
    });
  });

  it("n'appelle pas la lecture des closes quand 20 ouvertes suffisent", async () => {
    serve(
      Array.from({ length: 25 }, (_, i) => buildTask({ title: `Tâche ${i}` })),
    );
    renderPicker();
    await screen.findByText("Tâche 0");
    runAppAction.mockClear();

    fireEvent.change(input(), { target: { value: "tâche" } });
    await waitFor(() => expect(runAppAction).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(runAppAction).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("option")).toHaveLength(20);
  });

  it("exclut la tâche ouverte et les identifiants donnés ; topLevelOnly demandé pour une parente", async () => {
    const self = buildTask({ title: "Moi-même" });
    const linked = buildTask({ title: "Déjà reliée" });
    const other = buildTask({ title: "Candidate" });
    serve([self, linked, other]);
    renderPicker({
      excludeIds: [self.id, linked.id],
      topLevelOnly: true,
    });

    expect(await screen.findByText("Candidate")).not.toBeNull();
    expect(screen.queryByText("Moi-même")).toBeNull();
    expect(screen.queryByText("Déjà reliée")).toBeNull();
    expect(runAppAction.mock.calls[0]?.[1]).toMatchObject({
      topLevelOnly: true,
    });
  });

  it("sans topLevelOnly, ne le demande pas (relations : sous-tâches comprises)", async () => {
    serve([buildTask({ title: "Une" })]);
    renderPicker();
    await screen.findByText("Une");
    expect(runAppAction.mock.calls[0]?.[1]).not.toHaveProperty("topLevelOnly");
  });

  it("Entrée choisit la tâche en surbrillance", async () => {
    const target = buildTask({ title: "Première" });
    serve([target, buildTask({ title: "Seconde" })]);
    const { onSelect } = renderPicker();
    await screen.findByText("Première");

    input().focus();
    fireEvent.keyDown(input(), { key: "Enter" });

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: target.id });
  });

  it("les flèches changent la ligne en surbrillance avant Entrée", async () => {
    const second = buildTask({ title: "Seconde" });
    serve([buildTask({ title: "Première" }), second]);
    const { onSelect } = renderPicker();
    await screen.findByText("Première");

    input().focus();
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: second.id });
  });

  it("un clic choisit la tâche", async () => {
    const target = buildTask({ title: "Cliquée" });
    serve([target]);
    const { onSelect } = renderPicker();
    fireEvent.click(await screen.findByRole("option", { name: /Cliquée/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("Échap demande la fermeture (le parent rend le focus au déclencheur)", async () => {
    serve([buildTask({ title: "Une" })]);
    const { onCancel } = renderPicker();
    await screen.findByText("Une");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("état vide, chargement et erreur annoncés dans la zone de statut", async () => {
    serve([]);
    renderPicker();
    expect(screen.getByTestId("picker-status").textContent).toBe("Chargement…");
    await waitFor(() =>
      expect(screen.getByTestId("picker-status").textContent).toBe(
        "Aucune tâche trouvée.",
      ),
    );
    cleanup();

    runAppAction.mockResolvedValue({ ok: false });
    renderPicker();
    await waitFor(() =>
      expect(screen.getByTestId("picker-status").textContent).toBe(
        "La recherche a échoué. Réessaie.",
      ),
    );
  });

  it("une nouvelle frappe repasse tout de suite en chargement : ni l'ancien résultat ni l'ancienne erreur pendant le délai", async () => {
    serve([buildTask({ title: "Devis Trustup" })]);
    renderPicker();
    await screen.findByText("Devis Trustup");

    fireEvent.change(input(), { target: { value: "dev" } });

    expect(screen.getByTestId("picker-status").textContent).toBe("Chargement…");
    expect(screen.queryByText("Devis Trustup")).toBeNull();
    cleanup();

    runAppAction.mockResolvedValue({ ok: false });
    renderPicker();
    await waitFor(() =>
      expect(screen.getByTestId("picker-status").textContent).toBe(
        "La recherche a échoué. Réessaie.",
      ),
    );
    fireEvent.change(input(), { target: { value: "dev" } });

    expect(screen.getByTestId("picker-status").textContent).toBe("Chargement…");
  });

  it("une panne de l'appel (exception) est attrapée comme un échec", async () => {
    runAppAction.mockRejectedValue(new Error("boom"));
    renderPicker();
    await waitFor(() =>
      expect(screen.getByTestId("picker-status").textContent).toBe(
        "La recherche a échoué. Réessaie.",
      ),
    );
  });
});
