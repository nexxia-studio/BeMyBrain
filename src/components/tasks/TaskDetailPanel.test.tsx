import { afterEach, describe, expect, it, vi } from "vitest";

// Lecture du détail côté serveur : session et lectures du module remplacées par des témoins.
const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadTask = vi.hoisted(() => vi.fn());
const loadContexts = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/modules/tasks/load", () => ({ loadTask }));
vi.mock("@/modules/core/contexts", () => ({ loadContexts }));
vi.mock("next/navigation", () => ({ notFound }));

import { TaskDetailPanel } from "./TaskDetailPanel";

const TASK = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

afterEach(() => vi.clearAllMocks());

describe("détail d'une tâche : lecture en échec", () => {
  it("l'erreur de lecture remonte telle quelle à error.tsx de /tasks (ni 404, ni détail vide)", async () => {
    requireSessionWithToken.mockResolvedValue({
      session: { workspaceId: "ws-a" },
      token: "jwt",
    });
    const failure = new Error("lecture impossible");
    loadTask.mockRejectedValue(failure);

    await expect(TaskDetailPanel({ id: TASK, listQuery: "" })).rejects.toBe(
      failure,
    );

    expect(loadTask).toHaveBeenCalledWith("jwt", "ws-a", TASK);
    expect(notFound).not.toHaveBeenCalled();
    expect(loadContexts).not.toHaveBeenCalled();
  });

  it("tâche absente : 404, pas l'état d'erreur", async () => {
    requireSessionWithToken.mockResolvedValue({
      session: { workspaceId: "ws-a" },
      token: "jwt",
    });
    loadTask.mockResolvedValue(null);

    await expect(TaskDetailPanel({ id: TASK, listQuery: "" })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalledOnce();
  });
});
