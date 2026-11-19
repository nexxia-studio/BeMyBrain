import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../../messages/fr.json";
import { buildTask } from "../../../../tests/factories/build-task";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadCurrentScope = vi.hoisted(() => vi.fn());
const loadTaskList = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/lib/context-filter", () => ({ loadCurrentScope }));
vi.mock("@/modules/tasks/load", () => ({ loadTaskList }));
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction: vi.fn() }));
vi.mock("@/lib/preferences-actions", () => ({ setContextSelection: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "tasks.list") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son titre et ses contrôles.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: ({
    title,
    actions,
  }: {
    title: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

import TasksPage from "./page";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "Atelier Monie",
};
const TOKEN = "jeton";
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

async function renderPage(search: Record<string, string> = {}) {
  const element = await TasksPage({ searchParams: Promise.resolve(search) });
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      <OpenQuickAddContext value={vi.fn()}>{element}</OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  requireSessionWithToken.mockResolvedValue({ session: SESSION, token: TOKEN });
  loadTaskList.mockResolvedValue({ tasks: [], truncated: false });
});

afterEach(() => vi.clearAllMocks());

describe("page /tasks", () => {
  it("lit les tâches ouvertes du côté actif et de l'espace filtré, dans le workspace de la session", async () => {
    loadCurrentScope.mockResolvedValue({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      contextId: TRUSTUP.id,
    });

    await renderPage();

    expect(loadTaskList).toHaveBeenCalledWith(TOKEN, SESSION.workspaceId, {
      side: "pro",
      contextId: TRUSTUP.id,
      limit: 200,
    });
    expect(screen.getByText("Rien dans cet espace")).toBeTruthy();
  });

  it("sans espace filtré : tous les espaces du côté, vide non filtré", async () => {
    loadCurrentScope.mockResolvedValue({
      side: "private",
      contexts: [],
      contextId: null,
    });

    await renderPage();

    expect(loadTaskList).toHaveBeenCalledWith(TOKEN, SESSION.workspaceId, {
      side: "private",
      limit: 200,
    });
    expect(
      screen.getByRole("button", { name: "Ajouter une tâche" }),
    ).toBeTruthy();
  });

  it("interrupteur allumé (?completed=1) : terminées et annulées lues aussi", async () => {
    loadCurrentScope.mockResolvedValue({
      side: "private",
      contexts: [],
      contextId: null,
    });

    await renderPage({ completed: "1" });

    expect(loadTaskList).toHaveBeenCalledWith(TOKEN, SESSION.workspaceId, {
      side: "private",
      limit: 200,
      statusCategories: [
        "backlog",
        "unstarted",
        "started",
        "completed",
        "canceled",
      ],
    });
    expect(
      screen
        .getByRole("switch", { name: "Terminées" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("affiche le titre, les sections et le lien vers la corbeille", async () => {
    loadCurrentScope.mockResolvedValue({
      side: "private",
      contexts: [],
      contextId: null,
    });
    loadTaskList.mockResolvedValue({
      tasks: [buildTask({ title: "Payer la crèche" })],
      truncated: false,
    });

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "To-do" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Sans échéance" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Corbeille" }).getAttribute("href"),
    ).toBe("/tasks/trash");
    expect(screen.queryByText(/premières tâches/)).toBeNull();
  });

  it("pastille d'espace seulement quand le côté a plusieurs espaces et qu'aucun n'est filtré", async () => {
    const PERSO = {
      id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      name: "Perso",
      color: "neutral",
    } as const;
    loadCurrentScope.mockResolvedValueOnce({
      side: "private",
      contexts: [PERSO],
      contextId: null,
    });
    loadTaskList.mockResolvedValueOnce({
      tasks: [buildTask({ title: "Payer la crèche", contextName: "Perso" })],
      truncated: false,
    });
    await renderPage();
    expect(screen.queryByText("Perso")).toBeNull();

    loadCurrentScope.mockResolvedValueOnce({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      contextId: null,
    });
    loadTaskList.mockResolvedValueOnce({
      tasks: [
        buildTask({ title: "Relancer le devis", contextName: "Trustup" }),
      ],
      truncated: false,
    });
    await renderPage();

    expect(screen.getByText("Trustup")).toBeTruthy();
  });

  it("liste tronquée : le dit sous la liste", async () => {
    loadCurrentScope.mockResolvedValue({
      side: "private",
      contexts: [],
      contextId: null,
    });
    loadTaskList.mockResolvedValue({
      tasks: [buildTask()],
      truncated: true,
    });

    await renderPage();

    expect(
      screen.getByText("Seules les 200 premières tâches sont affichées."),
    ).toBeTruthy();
  });
});
