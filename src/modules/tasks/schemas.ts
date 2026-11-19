import { z } from "zod";

import { sideSchema } from "@/modules/core/schemas";

import { TaskError } from "./errors";
import {
  CONTEXT_NAME_MAX,
  openStatusCategories,
  statusCategories,
  TAG_NAME_MAX,
  TASK_LIST_DEFAULT_LIMIT,
  TASK_LIST_MAX_LIMIT,
  TASK_NOTES_MAX,
  TASK_QUERY_MAX,
  TASK_TAGS_PER_WRITE_MAX,
  TASK_TITLE_MAX,
} from "./sides";

export {
  openStatusCategories,
  statusCategories,
  type StatusCategory,
} from "./sides";

// Schémas du module tasks : validation des lectures (queries.ts), des écritures (mutations.ts) et des
// paramètres d'actions (actions.ts). `.describe()` en anglais : il devient la description du champ dans le
// JSON Schema d'outil lu par un modèle (unités, formats).
// Titre et nom de tag : `.trim()` ici, car la base ne borne la longueur qu'après `btrim`, qui ne retire que
// les espaces (une tabulation ou un retour à la ligne compterait comme du texte).

export const taskIdSchema = z.uuid().describe("Task id (UUID).");

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(TASK_TITLE_MAX)
  .describe(`Task title, 1 to ${TASK_TITLE_MAX} characters.`);

export const taskNotesSchema = z
  .string()
  .max(TASK_NOTES_MAX)
  .describe(`Free-text notes, up to ${TASK_NOTES_MAX} characters.`);

export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAG_NAME_MAX)
  .describe(
    `Tag name, 1 to ${TAG_NAME_MAX} characters, matched case-insensitively.`,
  );

export const statusCategorySchema = z
  .enum(statusCategories)
  .describe(
    "Status category: backlog, unstarted (to do), started (in progress), completed, canceled.",
  );

export const prioritySchema = z
  .number()
  .int()
  .min(0)
  .max(4)
  .describe("Priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low.");

export const dueDateSchema = z.iso
  .date()
  .describe("Due date, local calendar day, format YYYY-MM-DD.");

export const dueTimeSchema = z.iso
  .time({ precision: -1 })
  .describe("Due time, local, 24-hour format HH:MM. Requires a due date.");

export const listTasksFilterSchema = z.strictObject({
  side: sideSchema
    .optional()
    .describe(
      "Side of life: private (personal life) or pro (work). Omit for both.",
    ),
  contextId: z
    .uuid()
    .optional()
    .describe("Only tasks of this space (UUID). Omit for all spaces."),
  statusCategories: z
    .array(statusCategorySchema)
    .min(1)
    .max(statusCategories.length)
    .default([...openStatusCategories])
    .describe(
      "Status categories to include. Default: backlog, unstarted, started (completed and canceled excluded).",
    ),
  tag: tagNameSchema
    .optional()
    .describe("Only tasks carrying this tag name (case-insensitive)."),
  dueOnOrBefore: dueDateSchema
    .optional()
    .describe(
      "Only tasks due on or before this day, format YYYY-MM-DD. Tasks without a due date are excluded.",
    ),
  query: z
    .string()
    .trim()
    .min(1)
    .max(TASK_QUERY_MAX)
    .optional()
    .describe(
      `Text searched in task titles, case-insensitive, 1 to ${TASK_QUERY_MAX} characters. Accents must match.`,
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(TASK_LIST_MAX_LIMIT)
    .default(TASK_LIST_DEFAULT_LIMIT)
    .describe(
      `Maximum number of tasks returned, 1 to ${TASK_LIST_MAX_LIMIT}, default ${TASK_LIST_DEFAULT_LIMIT}.`,
    ),
});

export type ListTasksFilter = z.input<typeof listTasksFilterSchema>;

/** Lecture des tuiles par côté (`listUpcomingTasks`) : côté obligatoire, espace et limite comme `listTasks`. */
export const upcomingTasksFilterSchema = listTasksFilterSchema
  .pick({ contextId: true, limit: true })
  .extend({ side: sideSchema });
export type UpcomingTasksFilter = z.input<typeof upcomingTasksFilterSchema>;

export const contextNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(CONTEXT_NAME_MAX)
  .describe("Space name, exactly as listed for the side.");

const tagNamesSchema = z
  .array(tagNameSchema)
  .min(1)
  .max(TASK_TAGS_PER_WRITE_MAX);

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export const createTaskInputSchema = z
  .strictObject({
    title: taskTitleSchema,
    notes: taskNotesSchema.optional(),
    side: sideSchema
      .optional()
      .describe(
        "Side of life: private (personal life) or pro (work). Required for a top-level task without a space; omit for a subtask (it follows its parent).",
      ),
    context: contextNameSchema
      .optional()
      .describe(
        "Space name, exactly as listed. The task takes the side of the space. Omit for no space, and for a subtask (it follows its parent).",
      ),
    parentId: taskIdSchema
      .optional()
      .describe(
        "Parent task id (UUID) to create a subtask. The parent must be a top-level task.",
      ),
    statusCategory: statusCategorySchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema.optional(),
    dueTime: dueTimeSchema.optional(),
    tags: tagNamesSchema
      .optional()
      .describe(
        `Tag names, up to ${TASK_TAGS_PER_WRITE_MAX}, matched case-insensitively; unknown names are created.`,
      ),
  })
  .refine((v) => v.dueTime === undefined || v.dueDate !== undefined);

export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z
  .strictObject({
    taskId: taskIdSchema,
    title: taskTitleSchema.optional(),
    notes: taskNotesSchema
      .nullable()
      .optional()
      .describe(
        `Free-text notes, up to ${TASK_NOTES_MAX} characters; null clears them.`,
      ),
    side: sideSchema
      .optional()
      .describe(
        "New side: private or pro. Without a space, the task leaves its current space. Refused on a subtask.",
      ),
    context: contextNameSchema
      .nullable()
      .optional()
      .describe(
        "New space name, exactly as listed; the task takes the side of the space. null removes the space. Refused on a subtask.",
      ),
    statusCategory: statusCategorySchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: dueDateSchema
      .nullable()
      .optional()
      .describe(
        "Due date, local calendar day, format YYYY-MM-DD; null removes the due date and time.",
      ),
    dueTime: dueTimeSchema
      .nullable()
      .optional()
      .describe(
        "Due time, local, 24-hour format HH:MM; requires a due date. null removes the time.",
      ),
    addTags: tagNamesSchema
      .optional()
      .describe(
        `Tag names to add, up to ${TASK_TAGS_PER_WRITE_MAX}, case-insensitive; existing tags are kept, unknown names are created.`,
      ),
    removeTags: tagNamesSchema
      .optional()
      .describe(
        `Tag names to remove from this task, up to ${TASK_TAGS_PER_WRITE_MAX}, case-insensitive; a name the task does not carry is ignored.`,
      ),
  })
  .refine(
    (v) =>
      !(v.addTags ?? []).some((a) =>
        (v.removeTags ?? []).some((r) => sameName(a, r)),
      ),
  )
  .refine((v) => !(v.dueDate === null && typeof v.dueTime === "string"));

export type UpdateTaskInput = z.input<typeof updateTaskInputSchema>;

/** Valide une entrée ; refus → TaskError("invalid_params"), sans la valeur reçue (pas de ZodError masquée par withUserDb). */
export function parseTaskInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new TaskError("invalid_params");
  return result.data;
}
