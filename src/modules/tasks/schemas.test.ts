// @vitest-environment node
import { describe, expect, it } from "vitest";

import { TASK_ERROR_MESSAGES, TaskError, type TaskErrorCode } from "./errors";
import {
  boardFilterSchema,
  dueTimeSchema,
  listTasksFilterSchema,
  moveTaskInputSchema,
  parseTaskInput,
  setTaskParentInputSchema,
  tagNameSchema,
  taskRelationInputSchema,
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

  it("filtre de liste : topLevelOnly en option, absent par défaut, booléen seulement", () => {
    expect(listTasksFilterSchema.parse({ topLevelOnly: true })).toMatchObject({
      topLevelOnly: true,
    });
    expect(listTasksFilterSchema.parse({})).not.toHaveProperty("topLevelOnly");
    expect(
      listTasksFilterSchema.safeParse({ topLevelOnly: "oui" }).success,
    ).toBe(false);
  });

  it("filtre du tableau : côté obligatoire, sous-tâches visibles, terminées non masquées et 20 cartes closes par défaut", () => {
    const ok = (value: unknown) => boardFilterSchema.safeParse(value).success;

    expect(boardFilterSchema.parse({ side: "pro" })).toEqual({
      side: "pro",
      includeSubtasks: true,
      hideCompletedSubtasks: false,
      completedLimit: 20,
      canceledLimit: 20,
    });
    expect(ok({})).toBe(false);
    expect(ok({ side: "pro", completedLimit: 200, canceledLimit: 1 })).toBe(
      true,
    );
    expect(ok({ side: "pro", completedLimit: 201 })).toBe(false);
    expect(ok({ side: "pro", canceledLimit: 0 })).toBe(false);
    expect(ok({ side: "pro", contextId: "pas-un-uuid" })).toBe(false);
    expect(ok({ side: "pro", workspaceId: "x" })).toBe(false);
    expect(ok({ side: "pro", sortKey: "V" })).toBe(false);
  });

  it("filtre du tableau et topLevelOnly : chaque champ est décrit pour un modèle", () => {
    for (const field of Object.values(boardFilterSchema.shape)) {
      expect(field.description ?? "").not.toBe("");
    }
    expect(listTasksFilterSchema.shape.topLevelOnly.description).toMatch(
      /top-level/,
    );
  });

  it("déplacement : tâche et catégorie obligatoires, voisines en option, clé inconnue refusée", () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const beforeId = "22222222-2222-4222-8222-222222222222";
    const afterId = "33333333-3333-4333-8333-333333333333";
    const ok = (value: unknown) => moveTaskInputSchema.safeParse(value).success;

    expect(ok({ taskId, statusCategory: "started" })).toBe(true);
    expect(ok({ taskId, statusCategory: "started", beforeId, afterId })).toBe(
      true,
    );
    expect(ok({ taskId })).toBe(false);
    expect(ok({ taskId, statusCategory: "done" })).toBe(false);
    expect(ok({ taskId, statusCategory: "started", sortKey: "V" })).toBe(false);
    expect(ok({ taskId, statusCategory: "started", beforeId: "x" })).toBe(
      false,
    );
  });

  it("déplacement : voisines égales entre elles ou à la tâche déplacée refusées, casse ignorée", () => {
    const taskId = "aaaaaaaa-1111-4111-8111-111111111111";
    const other = "bbbbbbbb-2222-4222-8222-222222222222";
    const base = { taskId, statusCategory: "started" };
    const ok = (value: unknown) => moveTaskInputSchema.safeParse(value).success;

    expect(ok({ ...base, beforeId: other, afterId: other })).toBe(false);
    expect(ok({ ...base, beforeId: taskId })).toBe(false);
    expect(ok({ ...base, afterId: taskId })).toBe(false);
    expect(ok({ ...base, afterId: taskId.toUpperCase() })).toBe(false);
    expect(ok({ ...base, beforeId: other, afterId: other.toUpperCase() })).toBe(
      false,
    );
  });

  it("déplacement : chaque champ porte une description lisible par un modèle", () => {
    const schema = moveTaskInputSchema.toJSONSchema() as {
      properties: Record<string, { description?: string }>;
    };

    expect(Object.keys(schema.properties).sort()).toEqual([
      "afterId",
      "beforeId",
      "statusCategory",
      "taskId",
    ]);
    for (const property of Object.values(schema.properties)) {
      expect(property.description).toMatch(/^[A-Z].+\.$/);
    }
  });

  it("tâche parente : taskId et parentId obligatoires, null pour détacher, clé inconnue refusée", () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const parentId = "22222222-2222-4222-8222-222222222222";
    const ok = (value: unknown) =>
      setTaskParentInputSchema.safeParse(value).success;

    expect(ok({ taskId, parentId })).toBe(true);
    expect(ok({ taskId, parentId: null })).toBe(true);
    expect(ok({ taskId })).toBe(false);
    expect(ok({ parentId })).toBe(false);
    expect(ok({ taskId, parentId: "x" })).toBe(false);
    expect(ok({ taskId, parentId, side: "pro" })).toBe(false);
  });

  it("tâche parente : chaque champ porte une description lisible par un modèle", () => {
    const schema = setTaskParentInputSchema.toJSONSchema() as {
      properties: Record<string, { description?: string }>;
    };

    expect(Object.keys(schema.properties).sort()).toEqual([
      "parentId",
      "taskId",
    ]);
    // Espace : pris de la parente, perdu si elle n'en a pas, pas rendu par le détachement.
    expect(schema.properties.parentId!.description).toMatch(
      /loses its space.+does not give .+back/i,
    );
    for (const property of Object.values(schema.properties)) {
      expect(property.description).toMatch(/^[A-Z].+\.$/);
    }
  });

  it("relation : tâche, type et autre tâche obligatoires, trois types, clé inconnue refusée", () => {
    const taskId = "11111111-1111-4111-8111-111111111111";
    const otherTaskId = "22222222-2222-4222-8222-222222222222";
    const ok = (value: unknown) =>
      taskRelationInputSchema.safeParse(value).success;

    for (const kind of ["blocks", "blocked_by", "related"]) {
      expect(ok({ taskId, kind, otherTaskId })).toBe(true);
    }
    expect(ok({ taskId, kind: "duplicates", otherTaskId })).toBe(false);
    expect(ok({ taskId, otherTaskId })).toBe(false);
    expect(ok({ taskId, kind: "blocks" })).toBe(false);
    expect(ok({ kind: "blocks", otherTaskId })).toBe(false);
    expect(ok({ taskId, kind: "blocks", otherTaskId: "x" })).toBe(false);
    expect(ok({ taskId, kind: "blocks", otherTaskId, side: "pro" })).toBe(
      false,
    );
  });

  it("relation : chaque champ porte une description lisible par un modèle", () => {
    const schema = taskRelationInputSchema.toJSONSchema() as {
      properties: Record<string, { description?: string }>;
    };

    expect(Object.keys(schema.properties).sort()).toEqual([
      "kind",
      "otherTaskId",
      "taskId",
    ]);
    for (const property of Object.values(schema.properties)) {
      expect(property.description).toMatch(/^[A-Z].+\.$/);
    }
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
      "has_subtasks",
      "has_trashed_subtasks",
      "cross_side_parent",
      "cross_side_relation",
      "relation_conflict",
    ];

    expect(Object.keys(TASK_ERROR_MESSAGES).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      expect(TASK_ERROR_MESSAGES[code]).toMatch(/^[A-Z].+\.$/);
      expect(new TaskError(code).code).toBe(code);
    }
    // Lisibles par un modèle : la règle et la sortie.
    expect(TASK_ERROR_MESSAGES.has_subtasks).toMatch(
      /active subtasks.+detach.+tasks\.setParent.+has_trashed_subtasks/i,
    );
    // Pas de suppression définitive dans l'app : le remède est restaurer puis détacher, jamais « vider ».
    expect(TASK_ERROR_MESSAGES.has_trashed_subtasks).toMatch(
      /subtasks in the trash.+cannot be emptied.+tasks\.listTrash.+tasks\.restore.+tasks\.setParent.+parentId null/i,
    );
    expect(TASK_ERROR_MESSAGES.subtask_depth).toMatch(/detach the parent/i);
    expect(TASK_ERROR_MESSAGES.parent_in_trash).toBe(
      "The parent task is in the trash. Restore the parent first.",
    );
  });
});

describe("setTaskParentInputSchema", () => {
  it("la description de taskId cite les deux refus liés aux sous-tâches", () => {
    const description = setTaskParentInputSchema.shape.taskId.description;

    expect(description).toContain("has_subtasks");
    expect(description).toContain("has_trashed_subtasks");
  });
});
