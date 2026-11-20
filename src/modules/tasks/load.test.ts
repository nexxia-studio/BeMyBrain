import { afterEach, describe, expect, it, vi } from "vitest";

const withUserDb = vi.hoisted(() => vi.fn());
vi.mock("@/db/client", () => ({ withUserDb }));
const getTask = vi.hoisted(() => vi.fn());
const listDueToday = vi.hoisted(() => vi.fn());
const listUpcomingTasks = vi.hoisted(() => vi.fn());
const listTrashedTasks = vi.hoisted(() => vi.fn());
vi.mock("./queries", () => ({
  getTask,
  listTasks: vi.fn(),
  listDueToday,
  listUpcomingTasks,
  listTrashedTasks,
}));

import {
  loadDueToday,
  loadTask,
  loadTrashedTasks,
  loadUpcomingTasks,
} from "./load";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const TASK = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

afterEach(() => vi.clearAllMocks());

describe("loadTask", () => {
  it("lit la tâche dans le workspace de la session, avec son jeton", async () => {
    const tx = {};
    withUserDb.mockImplementation((_token, run) => run(tx));
    getTask.mockResolvedValue({ id: TASK });

    const task = await loadTask("jeton", WORKSPACE, TASK);

    expect(withUserDb).toHaveBeenCalledWith("jeton", expect.any(Function));
    expect(getTask).toHaveBeenCalledWith(WORKSPACE, TASK, tx);
    expect(task).toEqual({ id: TASK });
  });

  it("identifiant d'adresse qui n'est pas un uuid : null sans lire la base", async () => {
    const task = await loadTask("jeton", WORKSPACE, "pas-un-uuid");

    expect(task).toBeNull();
    expect(withUserDb).not.toHaveBeenCalled();
  });
});

describe("lectures du tableau de bord", () => {
  it("loadDueToday lit les tâches du jour dans le workspace de la session, avec son jeton", async () => {
    const tx = {};
    withUserDb.mockImplementation((_token, run) => run(tx));
    listDueToday.mockResolvedValue([{ id: TASK }]);

    const tasks = await loadDueToday("jeton", WORKSPACE, "2026-11-19");

    expect(withUserDb).toHaveBeenCalledWith("jeton", expect.any(Function));
    expect(listDueToday).toHaveBeenCalledWith(WORKSPACE, "2026-11-19", tx);
    expect(tasks).toEqual([{ id: TASK }]);
  });

  it("loadUpcomingTasks lit les prochaines tâches du côté dans le workspace de la session", async () => {
    const tx = {};
    withUserDb.mockImplementation((_token, run) => run(tx));
    listUpcomingTasks.mockResolvedValue([{ id: TASK }]);
    const filter = { side: "pro" as const, limit: 5 };

    const tasks = await loadUpcomingTasks("jeton", WORKSPACE, filter);

    expect(withUserDb).toHaveBeenCalledWith("jeton", expect.any(Function));
    expect(listUpcomingTasks).toHaveBeenCalledWith(WORKSPACE, filter, tx);
    expect(tasks).toEqual([{ id: TASK }]);
  });
});

describe("loadTrashedTasks", () => {
  it("lit la corbeille dans le workspace de la session, avec son jeton", async () => {
    const tx = {};
    withUserDb.mockImplementation((_token, run) => run(tx));
    listTrashedTasks.mockResolvedValue([{ id: TASK }]);

    const tasks = await loadTrashedTasks("jeton", WORKSPACE);

    expect(withUserDb).toHaveBeenCalledWith("jeton", expect.any(Function));
    expect(listTrashedTasks).toHaveBeenCalledWith(WORKSPACE, tx);
    expect(tasks).toEqual([{ id: TASK }]);
  });
});
