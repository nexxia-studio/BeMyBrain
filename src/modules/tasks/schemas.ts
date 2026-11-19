import { z } from "zod";

import { sideSchema } from "@/modules/core/schemas";

import { TaskError } from "./errors";
import {
  openStatusCategories,
  statusCategories,
  TAG_NAME_MAX,
  TASK_LIST_DEFAULT_LIMIT,
  TASK_LIST_MAX_LIMIT,
  TASK_NOTES_MAX,
  TASK_QUERY_MAX,
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

/** Valide une entrée ; refus → TaskError("invalid_input"), sans la valeur reçue (pas de ZodError masquée par withUserDb). */
export function parseTaskInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new TaskError("invalid_input");
  return result.data;
}
