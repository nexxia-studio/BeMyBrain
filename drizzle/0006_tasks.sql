-- To-do unifiée, tranche 1 (spec docs/features/todo-unifiee/spec.md) : tasks, tags, task_tags.
-- Additive (BRAIN-37) : une contrainte unique de plus sur contexts, trois tables neuves ; l'ancien
-- déploiement les ignore. Générée par drizzle-kit, complétée à la main pour ce que Drizzle n'exprime pas :
-- ON DELETE SET NULL ("context_id") de tasks_context_fk, triggers updated_at, droits d'app_backend.
-- Ordre : contrainte de contexts (cible de FK), tables, contraintes, index, policies, triggers, GRANT.
-- Pas de DELETE sur tasks ni tags : ni GRANT ni policy (corbeille = deleted_at).

-- Cible de tasks_context_fk : un espace du même workspace et du même côté.
ALTER TABLE "contexts" ADD CONSTRAINT "contexts_workspace_id_kind_unique" UNIQUE("workspace_id","id","kind");--> statement-breakpoint

CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "tags_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "tags_name_check" CHECK (char_length(btrim("tags"."name")) between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_tags" (
	"workspace_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_tags_pk" PRIMARY KEY("task_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "task_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"side" text NOT NULL,
	"context_id" uuid,
	"parent_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"status_category" text DEFAULT 'unstarted' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"due_date" date,
	"due_time" time,
	"completed_at" timestamp with time zone,
	"origin" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid DEFAULT app.current_user_id() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "tasks_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "tasks_workspace_id_id_side_unique" UNIQUE("workspace_id","id","side"),
	CONSTRAINT "tasks_side_check" CHECK ("tasks"."side" in ('private', 'pro')),
	CONSTRAINT "tasks_title_check" CHECK (char_length(btrim("tasks"."title")) between 1 and 500),
	CONSTRAINT "tasks_notes_check" CHECK (char_length("tasks"."notes") <= 10000),
	CONSTRAINT "tasks_status_category_check" CHECK ("tasks"."status_category" in ('backlog', 'unstarted', 'started', 'completed', 'canceled')),
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" between 0 and 4),
	CONSTRAINT "tasks_due_time_check" CHECK ("tasks"."due_time" is null or "tasks"."due_date" is not null),
	CONSTRAINT "tasks_origin_check" CHECK ("tasks"."origin" in ('app', 'palette', 'assistant', 'whatsapp', 'slack'))
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_fk" FOREIGN KEY ("workspace_id","task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "public"."tags"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_context_fk" FOREIGN KEY ("workspace_id","context_id","side") REFERENCES "public"."contexts"("workspace_id","id","kind") ON DELETE SET NULL ("context_id") ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_fk" FOREIGN KEY ("workspace_id","parent_id","side") REFERENCES "public"."tasks"("workspace_id","id","side") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_lower_name_unique" ON "tags" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "task_tags_workspace_tag_idx" ON "task_tags" USING btree ("workspace_id","tag_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_side_status_idx" ON "tasks" USING btree ("workspace_id","side","status_category") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_due_date_idx" ON "tasks" USING btree ("workspace_id","due_date") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_context_idx" ON "tasks" USING btree ("workspace_id","context_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_parent_idx" ON "tasks" USING btree ("workspace_id","parent_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_trash_idx" ON "tasks" USING btree ("workspace_id","deleted_at") WHERE deleted_at is not null;--> statement-breakpoint
CREATE POLICY "tags_select" ON "tags" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "tags_insert" ON "tags" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "tags_update" ON "tags" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("tags"."workspace_id")) WITH CHECK (app.is_workspace_member("tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "task_tags_select" ON "task_tags" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("task_tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "task_tags_insert" ON "task_tags" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("task_tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "task_tags_delete" ON "task_tags" AS PERMISSIVE FOR DELETE TO "app_backend" USING (app.is_workspace_member("task_tags"."workspace_id"));--> statement-breakpoint
CREATE POLICY "tasks_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("tasks"."workspace_id"));--> statement-breakpoint
CREATE POLICY "tasks_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("tasks"."workspace_id"));--> statement-breakpoint
CREATE POLICY "tasks_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("tasks"."workspace_id")) WITH CHECK (app.is_workspace_member("tasks"."workspace_id"));--> statement-breakpoint

-- updated_at tenu par la base (fonction de 0005, SECURITY INVOKER, aucun GRANT requis).
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER tags_set_updated_at BEFORE UPDATE ON public.tags
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- tasks : jamais fixés par l'app : id, created_by (default app.current_user_id()), created_at,
-- updated_at, deleted_at à la création. origin : à la création seulement. workspace_id et parent_id :
-- posés à la création, jamais modifiés (pas de déplacement entre workspaces ni de changement de parente).
-- DELETE : aucun droit (corbeille).
GRANT SELECT ON public.tasks TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, side, context_id, parent_id, title, notes, status_category, priority,
  due_date, due_time, completed_at, origin) ON public.tasks TO app_backend;
--> statement-breakpoint
GRANT UPDATE (side, context_id, title, notes, status_category, priority, due_date, due_time,
  completed_at, deleted_at) ON public.tasks TO app_backend;
--> statement-breakpoint

-- tags : création à la volée ; renommage possible (name). DELETE : aucun droit en tranche 1.
GRANT SELECT ON public.tags TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, name) ON public.tags TO app_backend;
--> statement-breakpoint
GRANT UPDATE (name) ON public.tags TO app_backend;
--> statement-breakpoint

-- task_tags : un lien s'ajoute ou se retire, jamais modifié (pas d'UPDATE).
GRANT SELECT, DELETE ON public.task_tags TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, task_id, tag_id) ON public.task_tags TO app_backend;
