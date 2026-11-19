import type { Task } from "@/modules/tasks/queries";

// Tâche en mémoire (aucune base) pour les tests des règles d'affichage et des composants.
// Chaque appel a un id distinct ; les champs non donnés valent une tâche Privé ouverte sans échéance.

let sequence = 0;

export function buildTask(overrides: Partial<Task> = {}): Task {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    side: "private",
    contextId: null,
    contextName: null,
    parentId: null,
    parentTitle: null,
    title: `Tâche ${sequence}`,
    statusCategory: "unstarted",
    priority: 0,
    dueDate: null,
    dueTime: null,
    completedAt: null,
    createdAt: new Date("2026-11-01T08:00:00Z"),
    tags: [],
    subtaskTotal: 0,
    subtaskDone: 0,
    ...overrides,
  };
}
