import { z } from "zod";

import { defineAction } from "@/modules/actions/define";
import { getUserTimeZone, todayIn } from "@/modules/core/time-zone";

import { TaskError } from "./errors";
import {
  completeTask,
  createTask,
  moveTaskToTrash,
  restoreTask,
  updateTask,
} from "./mutations";
import {
  findContextByName,
  getTask,
  listDueToday,
  listTags,
  listTasks,
  listTrashedTasks,
} from "./queries";
import {
  contextNameSchema,
  createTaskInputSchema,
  listTasksFilterSchema,
  taskIdSchema,
  updateTaskInputSchema,
} from "./schemas";

// Actions du module tasks (ADR-009), canaux web et assistant. Le workspace, l'utilisateur et l'origine
// viennent du contexte (session, point d'entrée serveur), jamais des paramètres : `z.strictObject` partout.
// Un espace se désigne par son nom (`context`), résolu dans le workspace de la session : aucun id d'espace
// en paramètre (spec « Identifiants »).

const channels = ["web", "assistant"] as const;

const taskIdParams = z.strictObject({ taskId: taskIdSchema });
const noParams = z.strictObject({});

// Filtre de listTasks, avec l'espace par son nom à la place de contextId.
const listTasksParams = listTasksFilterSchema.omit({ contextId: true }).extend({
  context: contextNameSchema
    .optional()
    .describe(
      "Only tasks of this space, by its name exactly as listed. Omit for all spaces.",
    ),
});

export const listTasksAction = defineAction({
  name: "tasks.list",
  description: "actions.tasks.list",
  params: listTasksParams,
  access: "read",
  channels,
  run: async (ctx, { context, ...filter }) => {
    let contextId: string | undefined;
    if (context !== undefined) {
      const found = await findContextByName(
        ctx.workspaceId,
        context,
        filter.side,
        ctx.tx,
      );
      if (!found) throw new TaskError("context_not_found");
      contextId = found.id;
    }
    return listTasks(ctx.workspaceId, { ...filter, contextId }, ctx.tx);
  },
});

export const getTaskAction = defineAction({
  name: "tasks.get",
  description: "actions.tasks.get",
  params: taskIdParams,
  access: "read",
  channels,
  run: async (ctx, { taskId }) => {
    const task = await getTask(ctx.workspaceId, taskId, ctx.tx);
    if (!task) throw new TaskError("not_found");
    return task;
  },
});

export const listDueTodayAction = defineAction({
  name: "tasks.listDueToday",
  description: "actions.tasks.listDueToday",
  params: noParams,
  access: "read",
  channels,
  run: (ctx) =>
    listDueToday(
      ctx.workspaceId,
      todayIn(getUserTimeZone(), new Date()),
      ctx.tx,
    ),
});

export const listTrashAction = defineAction({
  name: "tasks.listTrash",
  description: "actions.tasks.listTrash",
  params: noParams,
  access: "read",
  channels,
  run: (ctx) => listTrashedTasks(ctx.workspaceId, ctx.tx),
});

export const listTagsAction = defineAction({
  name: "tasks.listTags",
  description: "actions.tasks.listTags",
  params: noParams,
  access: "read",
  channels,
  run: (ctx) => listTags(ctx.workspaceId, ctx.tx),
});

export const createTaskAction = defineAction({
  name: "tasks.create",
  description: "actions.tasks.create",
  params: createTaskInputSchema,
  access: "write",
  channels,
  run: (ctx, input) => createTask(ctx.workspaceId, input, ctx.origin, ctx.tx),
});

export const updateTaskAction = defineAction({
  name: "tasks.update",
  description: "actions.tasks.update",
  params: updateTaskInputSchema,
  access: "write",
  channels,
  run: (ctx, input) => updateTask(ctx.workspaceId, input, ctx.tx),
});

export const completeTaskAction = defineAction({
  name: "tasks.complete",
  description: "actions.tasks.complete",
  params: taskIdParams,
  access: "write",
  channels,
  run: (ctx, { taskId }) => completeTask(ctx.workspaceId, taskId, ctx.tx),
});

export const moveToTrashAction = defineAction({
  name: "tasks.moveToTrash",
  description: "actions.tasks.moveToTrash",
  params: taskIdParams,
  access: "write",
  channels,
  run: (ctx, { taskId }) => moveTaskToTrash(ctx.workspaceId, taskId, ctx.tx),
});

export const restoreTaskAction = defineAction({
  name: "tasks.restore",
  description: "actions.tasks.restore",
  params: taskIdParams,
  access: "write",
  channels,
  run: (ctx, { taskId }) => restoreTask(ctx.workspaceId, taskId, ctx.tx),
});

export const tasksActions = [
  listTasksAction,
  getTaskAction,
  listDueTodayAction,
  listTrashAction,
  listTagsAction,
  createTaskAction,
  updateTaskAction,
  completeTaskAction,
  moveToTrashAction,
  restoreTaskAction,
] as const;
