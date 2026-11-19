import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/tasks/TaskTrashProvider", () => ({
  TaskTrashProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="trash-provider">{children}</div>
  ),
}));

import TasksLayout from "./layout";

describe("layout de /tasks", () => {
  it("rend la liste et le détail intercepté sous le même message de corbeille", () => {
    render(
      <TasksLayout detail={<p>détail</p>}>
        <p>liste</p>
      </TasksLayout>,
    );

    const provider = screen.getByTestId("trash-provider");
    expect(provider.textContent).toBe("listedétail");
  });
});
