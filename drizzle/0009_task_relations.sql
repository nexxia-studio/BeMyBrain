-- Kanban des tâches (BRAIN-46, spec docs/features/todo-kanban/spec.md) : relations entre tâches.
-- Additive (BRAIN-37) : une nouvelle table, rien d'autre. Aucune table existante touchée, aucun droit
-- retiré ; l'ancien code, qui ne connaît pas task_relations, tourne tel quel. Générée par drizzle-kit,
-- complétée à la main pour ce que Drizzle n'exprime pas : trigger updated_at et droits d'app_backend.
-- Ordre : table, RLS, clés étrangères, index, policies, trigger, GRANT.

-- kind : 'blocks' (from = la bloquante, to = la bloquée ; « Bloquée par » est la lecture inverse) ou
-- 'related' (symétrique, rangée une seule fois : plus petit identifiant en premier).
-- Pas de colonne de côté : la règle « même côté » est tenue par les mutations (tâche 8 du plan), pour
-- qu'une tâche puisse changer de côté sans écriture refusée (la relation est alors masquée à la
-- lecture). Durcissement en base (colonne side et clés étrangères composites) : BRAIN-59.
-- L'unicité porte workspace_id : une insertion d'un autre workspace ne heurte jamais une relation
-- existante, seule la clé étrangère composite répond (pas d'oracle d'existence entre workspaces).
CREATE TABLE "task_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"from_task_id" uuid NOT NULL,
	"to_task_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "task_relations_workspace_from_to_kind_unique" UNIQUE("workspace_id","from_task_id","to_task_id","kind"),
	CONSTRAINT "task_relations_kind_check" CHECK ("task_relations"."kind" in ('blocks', 'related')),
	CONSTRAINT "task_relations_not_self_check" CHECK ("task_relations"."from_task_id" <> "task_relations"."to_task_id"),
	CONSTRAINT "task_relations_related_order_check" CHECK ("task_relations"."kind" <> 'related' or "task_relations"."from_task_id" < "task_relations"."to_task_id")
);
--> statement-breakpoint
-- RLS dans la même migration que la table (ADR-002). Sans policy, tout est refusé à app_backend.
ALTER TABLE "task_relations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Les deux tâches sont du workspace de la relation (cible : tasks_workspace_id_id_unique) : la base
-- refuse une relation entre workspaces, quelle que soit la RLS.
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_from_task_fk" FOREIGN KEY ("workspace_id","from_task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_to_task_fk" FOREIGN KEY ("workspace_id","to_task_id") REFERENCES "public"."tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Index de la clé étrangère d'arrivée et lecture inverse (« Bloquée par », « bloquée »). La clé de
-- départ et workspace_id sont couverts par la contrainte d'unicité.
CREATE INDEX "task_relations_workspace_to_task_idx" ON "task_relations" USING btree ("workspace_id","to_task_id");--> statement-breakpoint
-- Une policy par verbe, par appartenance au workspace. Pas de policy UPDATE : une relation s'ajoute ou
-- se retire.
CREATE POLICY "task_relations_select" ON "task_relations" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("task_relations"."workspace_id"));--> statement-breakpoint
CREATE POLICY "task_relations_insert" ON "task_relations" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("task_relations"."workspace_id"));--> statement-breakpoint
CREATE POLICY "task_relations_delete" ON "task_relations" AS PERMISSIVE FOR DELETE TO "app_backend" USING (app.is_workspace_member("task_relations"."workspace_id"));--> statement-breakpoint

-- updated_at tenu par la base (fonction de 0005, SECURITY INVOKER, aucun GRANT requis). Convention de
-- toute table métier ; app_backend n'ayant aucun UPDATE, il ne se déclenche que pour le propriétaire.
CREATE TRIGGER task_relations_set_updated_at BEFORE UPDATE ON public.task_relations
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Droits d'app_backend : une relation se lit, s'ajoute ou se retire, jamais modifiée (aucun UPDATE).
-- Jamais fixés par l'app : id, created_at, updated_at.
GRANT SELECT, DELETE ON public.task_relations TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, from_task_id, to_task_id, kind) ON public.task_relations TO app_backend;
