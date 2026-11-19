import { isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTask } from "../../../tests/factories/build-task";

const loadTrashedTasks = vi.hoisted(() => vi.fn());
vi.mock("@/modules/tasks/load", () => ({ loadTrashedTasks }));

import { loadTrash, TRASH_TYPES } from "./trash-types";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const PARENT = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

afterEach(() => vi.clearAllMocks());

describe("registre de la corbeille", () => {
  it("déclare le type tâches : lecture de la corbeille du workspace, sous-tâches mises avec leur parente regroupées, restauration par tasks.restore", async () => {
    const deletedAt = new Date("2026-11-19T09:00:00Z");
    const parent = { ...buildTask({ id: PARENT }), deletedAt };
    const subtask = { ...buildTask({ parentId: PARENT }), deletedAt };
    loadTrashedTasks.mockResolvedValue([parent, subtask]);

    const items = await loadTrash("jeton", WORKSPACE);

    expect(TRASH_TYPES.map((type) => type.key)).toEqual(["task"]);
    expect(loadTrashedTasks).toHaveBeenCalledWith("jeton", WORKSPACE);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: `task:${PARENT}`,
      deletedAt,
      restore: { action: "tasks.restore", params: { taskId: PARENT } },
    });
    expect(isValidElement(items[0]?.row)).toBe(true);
    expect(items[0]?.row).toMatchObject({
      props: { item: { task: parent, subtaskCount: 1 } },
    });
  });

  it("rend la corbeille la plus récente d'abord", async () => {
    const older = {
      ...buildTask(),
      deletedAt: new Date("2026-11-17T10:00:00Z"),
    };
    const newer = {
      ...buildTask(),
      deletedAt: new Date("2026-11-19T10:00:00Z"),
    };
    loadTrashedTasks.mockResolvedValue([older, newer]);

    const items = await loadTrash("jeton", WORKSPACE);

    expect(items.map((item) => item.key)).toEqual([
      `task:${newer.id}`,
      `task:${older.id}`,
    ]);
  });
});
