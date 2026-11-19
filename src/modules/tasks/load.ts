// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";

import { uuidSchema } from "@/modules/core/schemas";

import { getTask, listTasks, type TaskDetail, type TaskList } from "./queries";
import type { ListTasksFilter } from "./schemas";

/**
 * Tâches du workspace de la session, lues avec son jeton (RLS active) et filtrées sur `workspaceId`
 * (double verrou, ADR-002). Point d'entrée des pages (src/app n'accède pas à la base).
 */
export function loadTaskList(
  token: string,
  workspaceId: string,
  filter: ListTasksFilter,
): Promise<TaskList> {
  return withUserDb(token, (tx) => listTasks(workspaceId, filter, tx));
}

/**
 * Une tâche active du workspace de la session (détail `/tasks/[id]`), même double verrou ; null si elle est
 * absente, à la corbeille, ou si l'identifiant de l'adresse n'est pas un uuid (aucune lecture : page 404).
 */
export async function loadTask(
  token: string,
  workspaceId: string,
  taskId: string,
): Promise<TaskDetail | null> {
  if (!uuidSchema.safeParse(taskId).success) return null;
  return withUserDb(token, (tx) => getTask(workspaceId, taskId, tx));
}
