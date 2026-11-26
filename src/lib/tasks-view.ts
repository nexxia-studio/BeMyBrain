// Valeurs des préférences d'affichage de la to-do, partagées par le serveur (`preferences.ts`, qui les valide)
// et par les contrôles clients. Sans zod ni `server-only` : importable dans le bundle client (docs/gotchas.md, CSP).

/** Vue de `/tasks` (spec todo-kanban, « Vue mémorisée »). */
export const tasksViews = ["list", "board"] as const;
export type TasksView = (typeof tasksViews)[number];
