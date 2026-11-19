// Valeurs du module tasks partagées avec le client, sans zod : importables par un composant client sans tirer
// zod dans le bundle (sa sonde `Function("")` déclenche une violation eval de la CSP de production).

/** Catégories de statut (Linear), figées : CHECK `tasks_status_category_check`. */
export const statusCategories = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;
export type StatusCategory = (typeof statusCategories)[number];

/** Catégories d'une tâche ouverte : lues par défaut, terminées et annulées exclues. */
export const openStatusCategories = [
  "backlog",
  "unstarted",
  "started",
] as const satisfies readonly StatusCategory[];

/** Longueurs maximales (après trim), mêmes bornes que les CHECK de la base. */
export const TASK_TITLE_MAX = 500;
export const TASK_NOTES_MAX = 10_000;
export const TAG_NAME_MAX = 50;
export const TASK_QUERY_MAX = 100;

/** `limit` de `listTasks` : défaut et plafond. */
export const TASK_LIST_DEFAULT_LIMIT = 50;
export const TASK_LIST_MAX_LIMIT = 200;
