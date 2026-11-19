// @vitest-environment node
import { describe, expect, it } from "vitest";

import { TASK_ERROR_MESSAGES, TaskError, type TaskErrorCode } from "./errors";
import {
  dueTimeSchema,
  listTasksFilterSchema,
  parseTaskInput,
  tagNameSchema,
  taskTitleSchema,
} from "./schemas";

describe("schémas tasks", () => {
  it("titre et nom de tag : espaces, tabulations et retours à la ligne retirés avant la longueur", () => {
    expect(taskTitleSchema.parse("\t Relancer le devis \n")).toBe(
      "Relancer le devis",
    );
    expect(tagNameSchema.parse("  client\n")).toBe("client");

    expect(taskTitleSchema.safeParse("\t\n ").success).toBe(false);
    expect(tagNameSchema.safeParse(" \t ").success).toBe(false);
    expect(taskTitleSchema.safeParse(` ${"x".repeat(500)} `).success).toBe(
      true,
    );
    expect(taskTitleSchema.safeParse("x".repeat(501)).success).toBe(false);
    expect(tagNameSchema.safeParse("x".repeat(51)).success).toBe(false);
  });

  it("heure au format HH:MM, sans secondes", () => {
    expect(dueTimeSchema.safeParse("14:00").success).toBe(true);
    expect(dueTimeSchema.safeParse("14:00:00").success).toBe(false);
    expect(dueTimeSchema.safeParse("25:00").success).toBe(false);
  });

  it("filtre de liste : terminées exclues et limit 50 par défaut, clé inconnue refusée", () => {
    expect(listTasksFilterSchema.parse({})).toEqual({
      statusCategories: ["backlog", "unstarted", "started"],
      limit: 50,
    });
    expect(listTasksFilterSchema.safeParse({ workspaceId: "x" }).success).toBe(
      false,
    );
  });

  it("parseTaskInput lève invalid_params sans la valeur reçue", () => {
    const error = (() => {
      try {
        parseTaskInput(taskTitleSchema, "");
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(TaskError);
    expect(error).toMatchObject({
      code: "invalid_params",
      message: "invalid_params",
    });
  });
});

describe("erreurs tasks", () => {
  it("chaque code a un message anglais non vide et fixe", () => {
    const codes: TaskErrorCode[] = [
      "invalid_params",
      "not_found",
      "context_not_found",
      "subtask_depth",
      "subtask_follows_parent",
      "parent_in_trash",
    ];

    expect(Object.keys(TASK_ERROR_MESSAGES).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      expect(TASK_ERROR_MESSAGES[code]).toMatch(/^[A-Z].+\.$/);
      expect(new TaskError(code).code).toBe(code);
    }
    expect(TASK_ERROR_MESSAGES.parent_in_trash).toBe(
      "The parent task is in the trash. Restore the parent first.",
    );
  });
});
