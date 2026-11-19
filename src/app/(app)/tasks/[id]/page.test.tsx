import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const TasksPage = vi.hoisted(() => vi.fn());
const TaskDetailPanel = vi.hoisted(() => vi.fn());
// Liste (page /tasks, testée à part) : remplacée par un témoin.
vi.mock("../page", () => ({
  default: (props: unknown) => {
    TasksPage(props);
    return <p>liste</p>;
  },
}));
vi.mock("@/components/tasks/TaskDetailPanel", () => ({ TaskDetailPanel }));

import TaskPage from "./page";

afterEach(() => vi.clearAllMocks());

describe("page /tasks/[id] (emplacement children)", () => {
  it("rend la liste seule, avec la requête de l'adresse ; le détail vit dans l'emplacement @detail", () => {
    const searchParams = Promise.resolve({ completed: "1" });

    render(<TaskPage searchParams={searchParams} />);

    expect(screen.getByText("liste")).toBeTruthy();
    expect(TasksPage).toHaveBeenCalledWith({ searchParams });
    expect(TaskDetailPanel).not.toHaveBeenCalled();
  });
});
