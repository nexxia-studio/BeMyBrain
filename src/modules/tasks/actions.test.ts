// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { UserTx } from "@/db/client";

import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";

const listTasks = vi.hoisted(() => vi.fn());
const getTask = vi.hoisted(() => vi.fn());
const listDueToday = vi.hoisted(() => vi.fn());
const listTrashedTasks = vi.hoisted(() => vi.fn());
const listTags = vi.hoisted(() => vi.fn());
const findContextByName = vi.hoisted(() => vi.fn());
const createTask = vi.hoisted(() => vi.fn());
const updateTask = vi.hoisted(() => vi.fn());
const completeTask = vi.hoisted(() => vi.fn());
const moveTaskToTrash = vi.hoisted(() => vi.fn());
const restoreTask = vi.hoisted(() => vi.fn());

vi.mock("./queries", () => ({
  listTasks,
  getTask,
  listDueToday,
  listTrashedTasks,
  listTags,
  findContextByName,
}));
vi.mock("./mutations", () => ({
  createTask,
  updateTask,
  completeTask,
  moveTaskToTrash,
  restoreTask,
}));

import {
  invokeAction,
  prepareAction,
  registry,
  toToolDefinitions,
} from "../actions/registry";
import { TASK_ERROR_MESSAGES } from "./errors";
import { tasksActions } from "./actions";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const TASK = "3a1f5c2e-8b7d-4e6f-9a0b-1c2d3e4f5a6b";
const CONTEXT = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const tx = {} as UserTx;
const CTX = {
  workspaceId: WORKSPACE,
  userId: USER,
  origin: "app" as const,
  tx,
};

const TASK_ACTIONS = [
  "tasks.list",
  "tasks.get",
  "tasks.listDueToday",
  "tasks.listTrash",
  "tasks.listTags",
  "tasks.create",
  "tasks.update",
  "tasks.complete",
  "tasks.moveToTrash",
  "tasks.restore",
];

/** Paramètres minimaux valides par action. */
const VALID: Record<string, Record<string, unknown>> = {
  "tasks.list": {},
  "tasks.get": { taskId: TASK },
  "tasks.listDueToday": {},
  "tasks.listTrash": {},
  "tasks.listTags": {},
  "tasks.create": { title: "Relancer le devis", side: "pro" },
  "tasks.update": { taskId: TASK, title: "Relancer le devis" },
  "tasks.complete": { taskId: TASK },
  "tasks.moveToTrash": { taskId: TASK },
  "tasks.restore": { taskId: TASK },
};

function run(name: string, params: unknown) {
  return invokeAction(prepareAction(registry, name, params, "web"), CTX);
}

function prepare(name: string, params: unknown) {
  return () => prepareAction(registry, name, params, "web");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("actions tasks.* : déclaration", () => {
  it("déclare les dix actions, sur les canaux web et assistant", () => {
    const names = tasksActions.map((action) => action.name);

    expect(names).toEqual(TASK_ACTIONS);
    for (const action of tasksActions) {
      expect(registry.get(action.name), action.name).toBe(action);
      expect(action.channels, action.name).toEqual(["web", "assistant"]);
    }
  });

  it("lectures en read, écritures en write", () => {
    const access = Object.fromEntries(
      tasksActions.map((action) => [action.name, action.access]),
    );

    expect(access).toEqual({
      "tasks.list": "read",
      "tasks.get": "read",
      "tasks.listDueToday": "read",
      "tasks.listTrash": "read",
      "tasks.listTags": "read",
      "tasks.create": "write",
      "tasks.update": "write",
      "tasks.complete": "write",
      "tasks.moveToTrash": "write",
      "tasks.restore": "write",
    });
  });

  it("toToolDefinitions('assistant') renvoie les dix actions tasks.*", () => {
    const names = toToolDefinitions("assistant")
      .map((tool) => tool.name)
      .filter((name) => name.startsWith("tasks."));

    expect(names.sort()).toEqual([...TASK_ACTIONS].sort());
  });
});

describe("actions tasks.* : paramètres", () => {
  it("chaque action valide ses paramètres en strictObject : une clé en trop est refusée", () => {
    for (const action of tasksActions) {
      const valid = VALID[action.name];
      const json = z.toJSONSchema(action.params, { io: "input" });

      expect(action.params.safeParse(valid).success, action.name).toBe(true);
      expect(json.type, action.name).toBe("object");
      expect(json.additionalProperties, action.name).toBe(false);
      for (const extra of ["workspaceId", "userId", "origin", "contextId"]) {
        expect(
          action.params.safeParse({ ...valid, [extra]: "x" }).success,
          `${action.name} + ${extra}`,
        ).toBe(false);
      }
    }
  });

  it("tasks.list refuse limit: 500 (invalid_params) sans rien lire", () => {
    const attempt = prepare("tasks.list", { limit: 500 });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
    expect(listTasks).not.toHaveBeenCalled();
  });

  it("tasks.list n'accepte pas contextId : l'espace se désigne par son nom", () => {
    const attempt = prepare("tasks.list", { contextId: CONTEXT });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
  });

  it("le schéma de tasks.update n'a pas de champ tags, seulement addTags et removeTags", () => {
    const update = tasksActions.find((a) => a.name === "tasks.update")!;
    const json = z.toJSONSchema(update.params, { io: "input" });
    const keys = Object.keys(json.properties ?? {});

    expect(keys).not.toContain("tags");
    expect(keys).toEqual(expect.arrayContaining(["addTags", "removeTags"]));
    expect(prepare("tasks.update", { taskId: TASK, tags: ["a"] })).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
  });

  it("tasks.update avec un même nom dans addTags et removeTags est refusé (invalid_params)", () => {
    const attempt = prepare("tasks.update", {
      taskId: TASK,
      addTags: ["Client"],
      removeTags: ["client"],
    });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
    expect(updateTask).not.toHaveBeenCalled();
  });
});

describe("actions tasks.* : lectures", () => {
  it("tasks.list lit le workspace de la session avec les filtres par défaut", async () => {
    listTasks.mockResolvedValue({ tasks: [], truncated: false });

    const result = await run("tasks.list", { side: "pro", query: "devis" });

    expect(result).toEqual({ tasks: [], truncated: false });
    expect(findContextByName).not.toHaveBeenCalled();
    expect(listTasks).toHaveBeenCalledWith(
      WORKSPACE,
      expect.objectContaining({
        side: "pro",
        query: "devis",
        limit: 50,
        statusCategories: ["backlog", "unstarted", "started"],
        contextId: undefined,
      }),
      tx,
    );
  });

  it("tasks.list résout l'espace par son nom, du côté demandé, dans le workspace de la session", async () => {
    findContextByName.mockResolvedValue({ id: CONTEXT, side: "pro" });
    listTasks.mockResolvedValue({ tasks: [], truncated: false });

    await run("tasks.list", { side: "pro", context: "Trustup" });

    expect(findContextByName).toHaveBeenCalledWith(
      WORKSPACE,
      "Trustup",
      "pro",
      tx,
    );
    expect(listTasks).toHaveBeenCalledWith(
      WORKSPACE,
      expect.objectContaining({ contextId: CONTEXT }),
      tx,
    );
    expect(listTasks.mock.calls[0][1]).not.toHaveProperty("context");
  });

  it("tasks.list avec un espace inconnu → context_not_found, rien de lu", async () => {
    findContextByName.mockResolvedValue(null);

    const attempt = run("tasks.list", { context: "Inconnu" });

    await expect(attempt).rejects.toMatchObject({ code: "context_not_found" });
    expect(listTasks).not.toHaveBeenCalled();
  });

  it("tasks.get renvoie la tâche du workspace de la session", async () => {
    getTask.mockResolvedValue({ id: TASK });

    const result = await run("tasks.get", { taskId: TASK });

    expect(result).toEqual({ id: TASK });
    expect(getTask).toHaveBeenCalledWith(WORKSPACE, TASK, tx);
  });

  it("tasks.get d'une tâche absente ou à la corbeille → not_found", async () => {
    getTask.mockResolvedValue(null);

    const attempt = run("tasks.get", { taskId: TASK });

    await expect(attempt).rejects.toMatchObject({ code: "not_found" });
  });

  it("tasks.listDueToday prend le jour local de l'utilisateur, pas le jour UTC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T23:30:00Z"));
    listDueToday.mockResolvedValue([]);

    await run("tasks.listDueToday", {});

    expect(listDueToday).toHaveBeenCalledWith(WORKSPACE, "2026-11-20", tx);
  });

  it("tasks.listTrash et tasks.listTags lisent le workspace de la session", async () => {
    listTrashedTasks.mockResolvedValue([]);
    listTags.mockResolvedValue([]);

    await run("tasks.listTrash", {});
    await run("tasks.listTags", {});

    expect(listTrashedTasks).toHaveBeenCalledWith(WORKSPACE, tx);
    expect(listTags).toHaveBeenCalledWith(WORKSPACE, tx);
  });
});

describe("actions tasks.* : écritures", () => {
  it("tasks.create passe l'origine du contexte, jamais un paramètre", async () => {
    createTask.mockResolvedValue({ id: TASK });

    await run("tasks.create", { title: "Relancer le devis", side: "pro" });

    expect(createTask).toHaveBeenCalledWith(
      WORKSPACE,
      { title: "Relancer le devis", side: "pro" },
      "app",
      tx,
    );
    expect(
      prepare("tasks.create", { title: "t", side: "pro", origin: "assistant" }),
    ).toThrow(expect.objectContaining({ code: "invalid_params" }));
  });

  it("tasks.update transmet addTags et removeTags tels quels", async () => {
    updateTask.mockResolvedValue({ id: TASK });

    await run("tasks.update", {
      taskId: TASK,
      addTags: ["a"],
      removeTags: ["b"],
    });

    expect(updateTask).toHaveBeenCalledWith(
      WORKSPACE,
      { taskId: TASK, addTags: ["a"], removeTags: ["b"] },
      tx,
    );
  });

  it("tasks.complete, tasks.moveToTrash et tasks.restore agissent sur la tâche donnée du workspace de la session", async () => {
    for (const [name, fn] of [
      ["tasks.complete", completeTask],
      ["tasks.moveToTrash", moveTaskToTrash],
      ["tasks.restore", restoreTask],
    ] as const) {
      fn.mockResolvedValue({ id: TASK });

      await run(name, { taskId: TASK });

      expect(fn, name).toHaveBeenCalledWith(WORKSPACE, TASK, tx);
    }
  });
});

describe("actions tasks.* : messages d'erreur", () => {
  it("chaque code d'erreur a un message anglais non vide, sans gabarit", () => {
    for (const [code, message] of Object.entries(TASK_ERROR_MESSAGES)) {
      expect(message.trim().length, code).toBeGreaterThan(0);
      expect(message, code).not.toMatch(/[{}]/);
    }
  });

  it("chaque code d'erreur a une traduction d'interface en français et en anglais", () => {
    const codes = Object.keys(TASK_ERROR_MESSAGES).sort();

    expect(Object.keys(fr.tasks.errors).sort()).toEqual(codes);
    expect(Object.keys(en.tasks.errors).sort()).toEqual(codes);
    for (const code of codes) {
      const key = code as keyof typeof fr.tasks.errors;
      expect(fr.tasks.errors[key].trim(), code).not.toBe("");
      expect(en.tasks.errors[key].trim(), code).not.toBe("");
    }
  });
});
