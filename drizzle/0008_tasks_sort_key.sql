-- Kanban des tâches (BRAIN-46, spec docs/features/todo-kanban/spec.md) : clé d'ordre manuelle et
-- parente modifiable.
-- Additive (BRAIN-37) : une colonne nullable sans défaut, un index, des droits en plus. Aucune donnée
-- réécrite, aucun droit retiré, aucune policy touchée ; l'ancien code, qui n'écrit pas sort_key, tourne
-- tel quel. Générée par drizzle-kit, complétée à la main pour ce que Drizzle n'exprime pas : COLLATE "C"
-- et droits d'app_backend.

-- Clé d'ordre fractionnaire, comparée octet par octet ('B' < 'a') quelle que soit la collation de la
-- base : l'ordre calculé par l'app (alphabet ASCII) est le même que celui de ORDER BY. NULL = tâche
-- jamais placée à la main.
ALTER TABLE "tasks" ADD COLUMN "sort_key" text COLLATE "C";--> statement-breakpoint
-- Lecture d'une colonne du tableau : tâches actives d'un workspace et d'une catégorie, par clé.
-- Sans CONCURRENTLY (drizzle-kit migre dans une transaction) : écritures sur tasks bloquées le temps
-- de la construction, négligeable à cette taille de table.
CREATE INDEX "tasks_workspace_status_sort_key_idx" ON "tasks" USING btree ("workspace_id","status_category","sort_key") WHERE deleted_at is null;--> statement-breakpoint

-- Droits d'app_backend, en plus de ceux de 0006 (SELECT y est global : il couvre sort_key).
-- sort_key : posée à la création et modifiée par les déplacements.
-- parent_id : remplace la règle de 0006 (« posé à la création, jamais modifié ») : une tâche peut
-- désormais être rattachée, détachée ou changer de parente. Garde-fou en base inchangé : tasks_parent_fk
-- (workspace_id, parent_id, side) refuse une parente d'un autre workspace ou de l'autre côté, et la
-- policy tasks_update limite l'écriture aux workspaces de l'utilisateur. Les autres règles (un seul
-- niveau, parente active) sont tenues par les mutations.
-- Toujours hors UPDATE : workspace_id (pas de déplacement entre workspaces), origin, id, created_by,
-- created_at, updated_at.
GRANT INSERT (sort_key) ON public.tasks TO app_backend;
--> statement-breakpoint
GRANT UPDATE (sort_key, parent_id) ON public.tasks TO app_backend;
