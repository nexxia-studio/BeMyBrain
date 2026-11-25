-- Kanban des tâches (BRAIN-60, spec docs/features/todo-kanban/spec.md) : deux contraintes sur tasks,
-- seconds verrous de règles déjà tenues par les mutations.
-- Additive (BRAIN-37) : deux CHECK, rien d'autre. Aucune colonne, aucun droit, aucune policy touchés ;
-- l'ancien code, qui n'écrit pas sort_key et ne pose parent_id qu'à la création (jamais la tâche
-- elle-même), tourne tel quel. Générée par drizzle-kit, sans complément à la main.
-- Aucune ligne existante ne les viole, vérifié le 2026-11-25 sur test, sur la copie de production de la
-- preview et en production : 0 tâche parente d'elle-même, 0 clé d'ordre. Validation immédiate (pas de
-- NOT VALID) : la table est relue sous verrou exclusif le temps de l'instruction, négligeable sur une
-- table presque vide.
-- Un CHECK qui vaut NULL passe : parent_id NULL (tâche de premier niveau) et sort_key NULL (tâche jamais
-- placée à la main) restent permis.

-- Une tâche n'est jamais sa propre parente. setTaskParent le refuse avant (invalid_params) ; la clé
-- étrangère tasks_parent_fk, elle, l'accepterait (la ligne existe, même workspace, même côté).
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_not_self_check" CHECK ("tasks"."parent_id" <> "tasks"."id");--> statement-breakpoint
-- Forme d'une clé d'ordre, celle du module (src/modules/tasks/sort-key.ts) : alphabet 0-9A-Za-z, jamais
-- vide, 64 caractères au plus (SORT_KEY_MAX_LENGTH, un test compare les deux valeurs), jamais terminée
-- par « 0 » (rien ne pourrait plus s'insérer juste avant elle). sort_key est COLLATE "C" (0008) : les
-- intervalles de l'expression régulière sont ceux de l'ASCII. Le module ne fait jamais lever cette
-- contrainte : au-delà de 64 caractères, moveTask remet la colonne en ordre avant d'écrire.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sort_key_check" CHECK ("tasks"."sort_key" ~ '^[0-9A-Za-z]+$' and char_length("tasks"."sort_key") <= 64 and right("tasks"."sort_key", 1) <> '0');
