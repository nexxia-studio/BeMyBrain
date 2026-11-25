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
const listBoard = vi.hoisted(() => vi.fn());
const moveTask = vi.hoisted(() => vi.fn());
const setTaskParent = vi.hoisted(() => vi.fn());
const addTaskRelation = vi.hoisted(() => vi.fn());
const removeTaskRelation = vi.hoisted(() => vi.fn());

vi.mock("./queries", () => ({
  listTasks,
  getTask,
  listDueToday,
  listTrashedTasks,
  listTags,
  findContextByName,
  listBoard,
}));
vi.mock("./mutations", () => ({
  createTask,
  updateTask,
  completeTask,
  moveTaskToTrash,
  restoreTask,
  moveTask,
  setTaskParent,
  addTaskRelation,
  removeTaskRelation,
}));

import {
  invokeAction,
  prepareAction,
  registry,
  toToolDefinitions,
} from "../actions/registry";
import { TASK_ERROR_MESSAGES, type TaskErrorCode } from "./errors";
import { tasksActions } from "./actions";
import { BOARD_CLOSED_DEFAULT_LIMIT, TASK_LIST_MAX_LIMIT } from "./sides";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const TASK = "3a1f5c2e-8b7d-4e6f-9a0b-1c2d3e4f5a6b";
const CONTEXT = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const OTHER_TASK = "7c8d9e0f-1a2b-4c3d-9e4f-5a6b7c8d9e0f";
const OTHER_WORKSPACE = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
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
  "tasks.move",
  "tasks.setParent",
  "tasks.addRelation",
  "tasks.removeRelation",
  "tasks.listBoard",
];

/** Les actions du tableau, de la parente et des relations (todo-kanban, tâche 10). */
const KANBAN_ACTIONS = [
  "tasks.move",
  "tasks.setParent",
  "tasks.addRelation",
  "tasks.removeRelation",
  "tasks.listBoard",
];

/** Tout ce que le module expose aux actions : une action n'en appelle qu'une, une seule fois. */
const MODULE_READS = {
  listTasks,
  getTask,
  listDueToday,
  listTrashedTasks,
  listTags,
  findContextByName,
  listBoard,
};
const MODULE_WRITES = {
  createTask,
  updateTask,
  completeTask,
  moveTaskToTrash,
  restoreTask,
  moveTask,
  setTaskParent,
  addTaskRelation,
  removeTaskRelation,
};

/** Fonctions du module appelées depuis le dernier `vi.clearAllMocks()`, une entrée par appel. */
const calledIn = (fns: Record<string, ReturnType<typeof vi.fn>>) =>
  Object.entries(fns).flatMap(([name, fn]) => fn.mock.calls.map(() => name));

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
  "tasks.move": { taskId: TASK, statusCategory: "started" },
  "tasks.setParent": { taskId: TASK, parentId: OTHER_TASK },
  "tasks.addRelation": {
    taskId: TASK,
    kind: "blocks",
    otherTaskId: OTHER_TASK,
  },
  "tasks.removeRelation": {
    taskId: TASK,
    kind: "blocks",
    otherTaskId: OTHER_TASK,
  },
  "tasks.listBoard": { side: "pro" },
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
  it("déclare les quinze actions, sur les canaux web et assistant", () => {
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
      "tasks.move": "write",
      "tasks.setParent": "write",
      "tasks.addRelation": "write",
      "tasks.removeRelation": "write",
      "tasks.listBoard": "read",
    });
  });

  it("toToolDefinitions('assistant') renvoie les quinze actions tasks.*", () => {
    const names = toToolDefinitions("assistant")
      .map((tool) => tool.name)
      .filter((name) => name.startsWith("tasks."));

    expect(names.sort()).toEqual([...TASK_ACTIONS].sort());
  });

  it("chaque outil tasks.* a une description anglaise non vide, lue dans messages/en.json", () => {
    const tools = toToolDefinitions("assistant").filter((tool) =>
      tool.name.startsWith("tasks."),
    );
    const english = en.actions.tasks as Record<string, string>;
    const french = fr.actions.tasks as Record<string, string>;

    expect(tools).toHaveLength(TASK_ACTIONS.length);
    for (const tool of tools) {
      const key = tool.name.slice("tasks.".length);
      expect(tool.description.trim(), tool.name).not.toBe("");
      expect(tool.description, tool.name).toBe(english[key]);
      expect(french[key]?.trim() ?? "", `${tool.name} (fr)`).not.toBe("");
      expect(french[key], `${tool.name} (fr)`).not.toBe(english[key]);
    }
  });

  it("la description de tasks.listBoard annonce les vraies limites du module", () => {
    const description = en.actions.tasks.listBoard;

    expect(description).toContain(`up to ${TASK_LIST_MAX_LIMIT} cards`);
    expect(description).toContain(`the ${BOARD_CLOSED_DEFAULT_LIMIT} most`);
  });

  it("chaque propriété du schéma JSON de chaque outil tasks.* a une description non vide", () => {
    const tools = toToolDefinitions("assistant").filter((tool) =>
      tool.name.startsWith("tasks."),
    );

    for (const tool of tools) {
      const declared = Object.keys(
        (registry.get(tool.name)!.params as z.ZodObject).shape ?? {},
      );
      const properties = (tool.inputSchema.properties ?? {}) as Record<
        string,
        { description?: string }
      >;

      expect(Object.keys(properties).sort(), tool.name).toEqual(
        declared.sort(),
      );
      for (const [key, property] of Object.entries(properties)) {
        expect(
          (property.description ?? "").trim(),
          `${tool.name}.${key}`,
        ).not.toBe("");
      }
    }
  });

  it("les schémas des actions du tableau, de la parente et des relations exposent exactement les champs de la spec", () => {
    const keys = Object.fromEntries(
      toToolDefinitions("assistant")
        .filter((tool) => KANBAN_ACTIONS.includes(tool.name))
        .map((tool) => [
          tool.name,
          Object.keys(tool.inputSchema.properties ?? {}).sort(),
        ]),
    );

    expect(keys).toEqual({
      "tasks.move": ["afterId", "beforeId", "statusCategory", "taskId"],
      "tasks.setParent": ["parentId", "taskId"],
      "tasks.addRelation": ["kind", "otherTaskId", "taskId"],
      "tasks.removeRelation": ["kind", "otherTaskId", "taskId"],
      "tasks.listBoard": [
        "canceledLimit",
        "completedLimit",
        "contextId",
        "hideCompletedSubtasks",
        "includeSubtasks",
        "side",
      ],
    });
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

  it("workspaceId, userId ou origin en paramètre d'une action du tableau, de la parente ou des relations → invalid_params, rien d'appelé, valeur absente du message", () => {
    for (const name of KANBAN_ACTIONS) {
      for (const [extra, value] of [
        ["workspaceId", OTHER_WORKSPACE],
        ["workspace_id", OTHER_WORKSPACE],
        ["userId", USER],
        ["origin", "assistant"],
      ]) {
        let caught: unknown;
        try {
          prepareAction(
            registry,
            name,
            { ...VALID[name], [extra]: value },
            "web",
          );
        } catch (error) {
          caught = error;
        }

        expect(caught, `${name} + ${extra}`).toMatchObject({
          code: "invalid_params",
          message: "invalid_params",
        });
      }
    }
    expect(calledIn({ ...MODULE_READS, ...MODULE_WRITES })).toEqual([]);
  });

  it("tasks.move refuse une voisine égale à la tâche, tasks.setParent un parentId absent, tasks.addRelation un type inconnu (invalid_params)", () => {
    const attempts: [string, Record<string, unknown>][] = [
      ["tasks.move", { ...VALID["tasks.move"], beforeId: TASK }],
      ["tasks.move", { taskId: TASK }],
      ["tasks.setParent", { taskId: TASK }],
      ["tasks.addRelation", { ...VALID["tasks.addRelation"], kind: "parent" }],
      ["tasks.removeRelation", { taskId: TASK, kind: "blocks" }],
      ["tasks.listBoard", {}],
      ["tasks.listBoard", { side: "pro", completedLimit: 500 }],
    ];

    for (const [name, params] of attempts) {
      expect(
        prepare(name, params),
        `${name} ${JSON.stringify(params)}`,
      ).toThrow(expect.objectContaining({ code: "invalid_params" }));
    }
    expect(calledIn({ ...MODULE_READS, ...MODULE_WRITES })).toEqual([]);
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

describe("actions tasks.* : tableau", () => {
  it("tasks.listBoard lit le tableau du workspace de la session, avec les options par défaut", async () => {
    const board = { columns: [] };
    listBoard.mockResolvedValue(board);

    const result = await run("tasks.listBoard", {
      side: "pro",
      contextId: CONTEXT,
    });

    expect(result).toBe(board);
    expect(listBoard).toHaveBeenCalledExactlyOnceWith(
      WORKSPACE,
      {
        side: "pro",
        contextId: CONTEXT,
        includeSubtasks: true,
        hideCompletedSubtasks: false,
        completedLimit: 20,
        canceledLimit: 20,
      },
      tx,
    );
  });
});

describe("actions tasks.* : une seule fonction du module par action", () => {
  it("chaque écriture appelle une seule mutation, une seule fois, et aucune lecture", async () => {
    const expected: Record<string, string> = {
      "tasks.create": "createTask",
      "tasks.update": "updateTask",
      "tasks.complete": "completeTask",
      "tasks.moveToTrash": "moveTaskToTrash",
      "tasks.restore": "restoreTask",
      "tasks.move": "moveTask",
      "tasks.setParent": "setTaskParent",
      "tasks.addRelation": "addTaskRelation",
      "tasks.removeRelation": "removeTaskRelation",
    };
    const writes = tasksActions.filter((action) => action.access === "write");

    expect(writes.map((action) => action.name).sort()).toEqual(
      Object.keys(expected).sort(),
    );
    for (const action of writes) {
      vi.clearAllMocks();
      for (const fn of Object.values(MODULE_WRITES))
        fn.mockResolvedValue({ id: TASK });

      await run(action.name, VALID[action.name]);

      expect(calledIn(MODULE_WRITES), action.name).toEqual([
        expected[action.name],
      ]);
      expect(calledIn(MODULE_READS), action.name).toEqual([]);
    }
  });

  it("chaque lecture appelle une seule lecture, une seule fois, et aucune mutation", async () => {
    const expected: Record<string, string> = {
      "tasks.list": "listTasks",
      "tasks.get": "getTask",
      "tasks.listDueToday": "listDueToday",
      "tasks.listTrash": "listTrashedTasks",
      "tasks.listTags": "listTags",
      "tasks.listBoard": "listBoard",
    };
    const reads = tasksActions.filter((action) => action.access === "read");

    expect(reads.map((action) => action.name).sort()).toEqual(
      Object.keys(expected).sort(),
    );
    for (const action of reads) {
      vi.clearAllMocks();
      for (const fn of Object.values(MODULE_READS))
        fn.mockResolvedValue({ id: TASK });

      await run(action.name, VALID[action.name]);

      expect(calledIn(MODULE_READS), action.name).toEqual([
        expected[action.name],
      ]);
      expect(calledIn(MODULE_WRITES), action.name).toEqual([]);
    }
  });
});

describe("actions tasks.* : écritures", () => {
  it("tasks.move, tasks.setParent, tasks.addRelation et tasks.removeRelation passent le workspace et la transaction du contexte, les paramètres tels quels, et renvoient le détail", async () => {
    const neighbours = { beforeId: OTHER_TASK, afterId: CONTEXT };
    const cases = [
      ["tasks.move", moveTask, { ...VALID["tasks.move"], ...neighbours }],
      ["tasks.setParent", setTaskParent, { taskId: TASK, parentId: null }],
      ["tasks.setParent", setTaskParent, VALID["tasks.setParent"]],
      [
        "tasks.addRelation",
        addTaskRelation,
        { taskId: TASK, kind: "blocked_by", otherTaskId: OTHER_TASK },
      ],
      [
        "tasks.removeRelation",
        removeTaskRelation,
        { taskId: TASK, kind: "related", otherTaskId: OTHER_TASK },
      ],
    ] as const;

    for (const [name, fn, params] of cases) {
      const detail = { id: TASK };
      fn.mockReset();
      fn.mockResolvedValue(detail);

      const result = await run(name, params);

      expect(result, name).toBe(detail);
      expect(fn, name).toHaveBeenCalledExactlyOnceWith(WORKSPACE, params, tx);
      expect(fn.mock.calls[0][2], name).toBe(tx);
    }
  });

  it("le workspace et l'origine viennent du contexte : un autre contexte change le workspace transmis, aucun paramètre ne le peut", async () => {
    const otherTx = {} as UserTx;
    const otherCtx = {
      workspaceId: OTHER_WORKSPACE,
      userId: USER,
      origin: "assistant" as const,
      tx: otherTx,
    };
    const fns: Record<string, ReturnType<typeof vi.fn>> = {
      "tasks.move": moveTask,
      "tasks.setParent": setTaskParent,
      "tasks.addRelation": addTaskRelation,
      "tasks.removeRelation": removeTaskRelation,
      "tasks.listBoard": listBoard,
    };

    for (const name of KANBAN_ACTIONS) {
      fns[name].mockResolvedValue({ id: TASK });

      await invokeAction(
        prepareAction(registry, name, VALID[name], "assistant"),
        otherCtx,
      );

      const [workspaceId, params, usedTx] = fns[name].mock.calls[0];
      expect(workspaceId, name).toBe(OTHER_WORKSPACE);
      expect(usedTx, name).toBe(otherTx);
      expect(JSON.stringify(params), name).not.toContain(OTHER_WORKSPACE);
      expect(JSON.stringify(params), name).not.toContain("assistant");
      expect(fns[name].mock.calls[0], name).toHaveLength(3);
    }
  });

  it("le refus d'une mutation remonte tel quel : un code, sans donnée de la tâche", async () => {
    const { TaskError } = await import("./errors");
    const refusal = new TaskError("has_subtasks");
    setTaskParent.mockRejectedValue(refusal);

    const attempt = run("tasks.setParent", VALID["tasks.setParent"]);

    await expect(attempt).rejects.toBe(refusal);
    expect(refusal.message).toBe("has_subtasks");
  });

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
  it("chaque code de TaskErrorCode a son message anglais et sa clé tasks.errors.<code> en français et en anglais", () => {
    // Liste exhaustive vérifiée par le compilateur : un code ajouté au type sans entrée ici ne compile pas.
    const codes = Object.keys({
      invalid_params: true,
      not_found: true,
      context_not_found: true,
      subtask_depth: true,
      subtask_follows_parent: true,
      parent_in_trash: true,
      has_subtasks: true,
      cross_side_parent: true,
      cross_side_relation: true,
      relation_conflict: true,
    } satisfies Record<TaskErrorCode, true>) as TaskErrorCode[];
    const french = fr.tasks.errors as Record<string, string>;
    const english = en.tasks.errors as Record<string, string>;

    expect(Object.keys(TASK_ERROR_MESSAGES).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      expect(TASK_ERROR_MESSAGES[code].trim(), code).not.toBe("");
      expect(TASK_ERROR_MESSAGES[code], code).toMatch(/^[A-Z][^{}]*\.$/);
      expect((french[code] ?? "").trim(), `${code} (fr)`).not.toBe("");
      expect((english[code] ?? "").trim(), `${code} (en)`).not.toBe("");
      expect(french[code], `${code} (fr)`).not.toBe(english[code]);
    }
  });

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
