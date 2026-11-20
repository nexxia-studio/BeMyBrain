import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const TaskDetailPanel = vi.hoisted(() => vi.fn());
vi.mock("@/components/tasks/TaskDetailPanel", () => ({
  TaskDetailPanel: async (props: unknown) => {
    TaskDetailPanel(props);
    return <p>détail</p>;
  },
}));

import TaskDetailOverList from "./page";

const TASK = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

afterEach(() => vi.clearAllMocks());

describe("détail intercepté /tasks/[id] (ouvert depuis la liste)", () => {
  it("rend le détail de la tâche de l'adresse, requête de la liste gardée", async () => {
    const element = await TaskDetailOverList({
      params: Promise.resolve({ id: TASK }),
      searchParams: Promise.resolve({ completed: "1" }),
    });
    render(element);

    expect(TaskDetailPanel).toHaveBeenCalledWith({
      id: TASK,
      listQuery: "?completed=1",
    });
    expect(screen.getByText("détail")).toBeTruthy();
  });
});
