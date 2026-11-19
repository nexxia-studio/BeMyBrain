// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { withUserDb } from "@/db/client";

import { listTasks, type TaskList } from "./queries";
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
