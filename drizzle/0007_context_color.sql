-- To-do unifiée, tâche 16a : couleur de pastille par espace (décision d'Antoine, 2026-11-19).
-- Additive (BRAIN-37) : colonne avec défaut, l'ancien code ne la lit pas.
-- Droits : SELECT d'app_backend sur contexts est global (0002), il couvre donc la nouvelle colonne.
-- INSERT et UPDATE sont par colonne (0005) et n'incluent pas color : app_backend ne la fixe ni ne la
-- modifie (aucun écran pour la changer, BRAIN-30). Rien à accorder ici.
ALTER TABLE "contexts" ADD COLUMN "color" text DEFAULT 'neutral' NOT NULL;--> statement-breakpoint
ALTER TABLE "contexts" ADD CONSTRAINT "contexts_color_check" CHECK ("contexts"."color" in ('neutral', 'warm', 'indigo'));--> statement-breakpoint
-- Espaces existants, par nom (ceux du seed, présents en production) : Privé reste neutral (défaut).
UPDATE "contexts" SET "color" = 'warm' WHERE "name" = 'Trustup';--> statement-breakpoint
UPDATE "contexts" SET "color" = 'indigo' WHERE "name" = 'Nexxia';
