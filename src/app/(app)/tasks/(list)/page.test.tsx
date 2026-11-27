import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenQuickAddContext } from "@/components/quick-add/quick-add-context";
import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../../../messages/fr.json";
import { buildTask } from "../../../../../tests/factories/build-task";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadCurrentScope = vi.hoisted(() => vi.fn());
const loadTaskList = vi.hoisted(() => vi.fn());
const loadBoard = vi.hoisted(() => vi.fn());
const readTasksView = vi.hoisted(() => vi.fn());
const readBoardOptions = vi.hoisted(() => vi.fn());
const taskBoardProps = vi.hoisted(() => vi.fn());
const boardOptionsProps = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/lib/context-filter", () => ({ loadCurrentScope }));
vi.mock("@/modules/tasks/load", () => ({ loadTaskList, loadBoard }));
vi.mock("@/lib/preferences", () => ({ readTasksView, readBoardOptions }));
vi.mock("@/app/(app)/tasks/actions", () => ({ runAppAction: vi.fn() }));
vi.mock("@/lib/preferences-actions", () => ({
  setContextSelection: vi.fn(),
  setTasksView: vi.fn(),
}));
// Tableau et options : composants clients testés à part, remplacés ici par le relevé de leurs props.
vi.mock("@/components/tasks/TaskBoard", () => ({
  TaskBoard: (props: unknown) => {
    taskBoardProps(props);
    return <div data-testid="task-board" />;
  },
}));
vi.mock("@/components/tasks/BoardOptions", () => ({
  BoardOptions: (props: unknown) => {
    boardOptionsProps(props);
    return <div data-testid="board-options" />;
  },
}));
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

const BOARD_COLUMNS = (
  ["backlog", "unstarted", "started", "completed", "canceled"] as const
).map((category) => ({ category, tasks: [], total: 0, truncated: false }));

const PRIVATE_SCOPE = { side: "private", contexts: [], contextId: null };

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
  readTasksView.mockResolvedValue("list");
  readBoardOptions.mockResolvedValue({
    subtasks: true,
    hideDoneSubtasks: false,
    canceledOpen: false,
  });
  loadBoard.mockResolvedValue({ columns: BOARD_COLUMNS });
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
    ).toBe("/trash");
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

  it("vue Liste : sélecteur de vue et interrupteur « Terminées » dans l'en-tête, aucune lecture du tableau", async () => {
    loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);

    await renderPage();

    const view = screen.getByRole("group", { name: "Vue" });
    expect(view.closest("header")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Liste" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("switch", { name: "Terminées" })).toBeTruthy();
    expect(loadBoard).not.toHaveBeenCalled();
    expect(screen.queryByTestId("task-board")).toBeNull();
    expect(screen.queryByTestId("board-options")).toBeNull();
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

  describe("vue Tableau", () => {
    beforeEach(() => readTasksView.mockResolvedValue("board"));

    it("lit le tableau du côté actif et de l'espace filtré, avec les options mémorisées, dans le workspace de la session", async () => {
      loadCurrentScope.mockResolvedValue({
        side: "pro",
        contexts: [TRUSTUP, NEXXIA],
        contextId: TRUSTUP.id,
      });
      readBoardOptions.mockResolvedValue({
        subtasks: false,
        hideDoneSubtasks: true,
        canceledOpen: true,
      });

      await renderPage();

      expect(loadBoard).toHaveBeenCalledExactlyOnceWith(
        TOKEN,
        SESSION.workspaceId,
        {
          side: "pro",
          contextId: TRUSTUP.id,
          includeSubtasks: false,
          hideCompletedSubtasks: true,
          completedLimit: 20,
          canceledLimit: 20,
        },
      );
      expect(loadTaskList).not.toHaveBeenCalled();
      expect(boardOptionsProps).toHaveBeenCalledWith({
        subtasks: false,
        hideDoneSubtasks: true,
      });
      expect(taskBoardProps).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: BOARD_COLUMNS,
          canceledOpen: true,
          showContext: false,
          listQuery: "",
        }),
      );
    });

    it("sans espace filtré : tous les espaces du côté, pastille d'espace sur les cartes s'il y en a plusieurs", async () => {
      loadCurrentScope.mockResolvedValue({
        side: "pro",
        contexts: [TRUSTUP, NEXXIA],
        contextId: null,
      });

      await renderPage();

      expect(loadBoard.mock.calls[0][2]).toEqual({
        side: "pro",
        includeSubtasks: true,
        hideCompletedSubtasks: false,
        completedLimit: 20,
        canceledLimit: 20,
      });
      expect(taskBoardProps).toHaveBeenCalledWith(
        expect.objectContaining({ showContext: true }),
      );
    });

    it("le tableau à la place de la liste : sélecteur de vue sur Tableau, options au-dessus, pas d'interrupteur « Terminées »", async () => {
      loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);

      await renderPage();

      expect(
        screen
          .getByRole("button", { name: "Tableau" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(screen.queryByRole("switch", { name: "Terminées" })).toBeNull();
      const options = screen.getByTestId("board-options");
      const board = screen.getByTestId("task-board");
      expect(
        options.compareDocumentPosition(board) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Corbeille" }).getAttribute("href"),
      ).toBe("/trash");
    });

    it("« Tout voir » de Terminée (?done=all) : limite portée au plafond, lien de retour vers les 20 plus récentes", async () => {
      loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);

      await renderPage({ done: "all" });

      expect(loadBoard.mock.calls[0][2]).toMatchObject({
        completedLimit: 200,
        canceledLimit: 20,
      });
      expect(taskBoardProps).toHaveBeenCalledWith(
        expect.objectContaining({
          listQuery: "?done=all",
          seeAll: {
            completed: { expanded: true, href: "/tasks" },
            canceled: {
              expanded: false,
              href: "/tasks?done=all&canceled=all",
            },
          },
        }),
      );
    });

    it("« Tout voir » d'Annulée (?canceled=all) : sa limite au plafond, celle de Terminée inchangée", async () => {
      loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);

      await renderPage({ canceled: "all" });

      expect(loadBoard.mock.calls[0][2]).toMatchObject({
        completedLimit: 20,
        canceledLimit: 200,
      });
      expect(taskBoardProps).toHaveBeenCalledWith(
        expect.objectContaining({
          seeAll: {
            completed: {
              expanded: false,
              href: "/tasks?done=all&canceled=all",
            },
            canceled: { expanded: true, href: "/tasks" },
          },
        }),
      );
    });

    it("valeur inattendue de ?done ou de ?canceled (1, répétée, autre mot) : 20 cartes au plus, « Tout voir » non déplié", async () => {
      loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);

      await renderPage({ done: "1" });
      await renderPage({ done: ["all", "all"] } as unknown as Record<
        string,
        string
      >);
      await renderPage({ canceled: "oui" });

      expect(loadBoard).toHaveBeenCalledTimes(3);
      for (const [, , filter] of loadBoard.mock.calls) {
        expect(filter).toMatchObject({ completedLimit: 20, canceledLimit: 20 });
      }
      for (const [props] of taskBoardProps.mock.calls) {
        expect(props).toMatchObject({
          listQuery: "",
          seeAll: {
            completed: { expanded: false },
            canceled: { expanded: false },
          },
        });
      }
    });

    it("périmètre lu remis au tableau : il change avec le côté, l'espace et les options de sous-tâches", async () => {
      loadCurrentScope.mockResolvedValue(PRIVATE_SCOPE);
      await renderPage();
      loadCurrentScope.mockResolvedValue({ ...PRIVATE_SCOPE, side: "pro" });
      await renderPage();
      readBoardOptions.mockResolvedValue({
        subtasks: false,
        hideDoneSubtasks: false,
        canceledOpen: false,
      });
      await renderPage();

      const keys = taskBoardProps.mock.calls.map(
        ([props]) => (props as { scopeKey: string }).scopeKey,
      );

      expect(new Set(keys).size).toBe(3);
    });
  });
});
