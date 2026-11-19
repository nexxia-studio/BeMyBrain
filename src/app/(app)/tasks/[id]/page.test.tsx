import { render, screen } from "@testing-library/react";
import { isHTTPAccessFallbackError } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";

import messages from "../../../../../messages/fr.json";
import { buildTask } from "../../../../../tests/factories/build-task";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadTask = vi.hoisted(() => vi.fn());
const loadContexts = vi.hoisted(() => vi.fn());
const TaskDetail = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/modules/tasks/load", () => ({ loadTask }));
vi.mock("@/modules/core/contexts", () => ({ loadContexts }));
// Liste dessous (page /tasks, testée à part) et détail (testé à part) : remplacés par des témoins.
vi.mock("../page", () => ({ default: () => <p>liste</p> }));
vi.mock("@/components/tasks/TaskDetail", () => ({
  TaskDetail: (props: unknown) => {
    TaskDetail(props);
    return <p>détail</p>;
  },
}));

import TaskPage from "./page";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "Atelier Monie",
};
const TOKEN = "jeton";
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };

function detail(overrides = {}) {
  return {
    ...buildTask({ side: "pro", ...overrides }),
    notes: null,
    subtasks: [],
  };
}

async function renderPage(id: string, search: Record<string, string> = {}) {
  const element = await TaskPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(search),
  });
  return render(
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  requireSessionWithToken.mockResolvedValue({ session: SESSION, token: TOKEN });
  loadContexts.mockResolvedValue([{ ...TRUSTUP, kind: "pro" }]);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("page /tasks/[id]", () => {
  it("lit la tâche et les espaces de son côté dans le workspace de la session, détail au-dessus de la liste", async () => {
    const task = detail();
    loadTask.mockResolvedValue(task);

    await renderPage(task.id);

    expect(loadTask).toHaveBeenCalledWith(TOKEN, SESSION.workspaceId, task.id);
    expect(loadContexts).toHaveBeenCalledWith(
      TOKEN,
      SESSION.workspaceId,
      "pro",
    );
    expect(TaskDetail).toHaveBeenCalledWith({
      task,
      contexts: [TRUSTUP],
      today: "2026-11-19",
      listQuery: "",
    });
    expect(screen.getByText("liste")).toBeTruthy();
    expect(screen.getByText("détail")).toBeTruthy();
  });

  it("terminées affichées : la requête de la liste passe au détail", async () => {
    const task = detail();
    loadTask.mockResolvedValue(task);

    await renderPage(task.id, { completed: "1" });

    expect(TaskDetail).toHaveBeenCalledWith(
      expect.objectContaining({ listQuery: "?completed=1" }),
    );
  });

  it("sous-tâche : espaces non lus (côté et espace suivent la parente)", async () => {
    loadTask.mockResolvedValue(
      detail({ parentId: "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f" }),
    );

    await renderPage("3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e50");

    expect(loadContexts).not.toHaveBeenCalled();
    expect(TaskDetail).toHaveBeenCalledWith(
      expect.objectContaining({ contexts: [] }),
    );
  });

  it("tâche absente, à la corbeille ou adresse invalide : 404", async () => {
    loadTask.mockResolvedValue(null);

    const error = await TaskPage({
      params: Promise.resolve({ id: "inconnue" }),
      searchParams: Promise.resolve({}),
    }).catch((caught: unknown) => caught);

    expect(isHTTPAccessFallbackError(error)).toBe(true);
  });
});
