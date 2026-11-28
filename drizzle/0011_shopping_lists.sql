-- Listes (BRAIN-9, spec docs/features/listes/spec.md) : courses, tranche A. Quatre tables neuves.
-- Additive (BRAIN-37) : rien d'existant touché, l'ancien code les ignore. Générée par drizzle-kit,
-- complétée à la main pour ce que Drizzle n'exprime pas : triggers updated_at et droits d'app_backend.
-- Ordre : tables, RLS, clés étrangères, index, policies, fonction, triggers, GRANT.
-- RLS : une policy par verbe accordé. shopping_aisle_overrides et shopping_aisle_order sont propres à
-- l'utilisateur : membre du workspace ET user_id = app.current_user_id(). Aucune policy pour un invité
-- (le partage, PR B, passe par des fonctions SECURITY DEFINER).

CREATE TABLE "shopping_aisle_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid DEFAULT app.current_user_id() NOT NULL,
	"aisle_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "shopping_aisle_order_workspace_user_unique" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "shopping_aisle_order_keys_check" CHECK (cardinality("shopping_aisle_order"."aisle_keys") <= 12 and "shopping_aisle_order"."aisle_keys" <@ array['produce', 'bakery', 'butcherFish', 'dairyEggs', 'pantrySavory', 'pantrySweet', 'drinks', 'household', 'hygiene', 'babyPets', 'frozen', 'other']::text[])
);
--> statement-breakpoint
ALTER TABLE "shopping_aisle_order" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_aisle_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid DEFAULT app.current_user_id() NOT NULL,
	"keyword" text NOT NULL,
	"aisle_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "shopping_aisle_overrides_workspace_user_keyword_unique" UNIQUE("workspace_id","user_id","keyword"),
	CONSTRAINT "shopping_aisle_overrides_keyword_check" CHECK (char_length(btrim("shopping_aisle_overrides"."keyword")) between 1 and 80),
	CONSTRAINT "shopping_aisle_overrides_aisle_key_check" CHECK ("shopping_aisle_overrides"."aisle_key" in ('produce', 'bakery', 'butcherFish', 'dairyEggs', 'pantrySavory', 'pantrySweet', 'drinks', 'household', 'hygiene', 'babyPets', 'frozen', 'other'))
);
--> statement-breakpoint
ALTER TABLE "shopping_aisle_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"label" text NOT NULL,
	"aisle_key" text NOT NULL,
	"aisle_pinned" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"added_by_guest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "shopping_items_label_check" CHECK (char_length(btrim("shopping_items"."label")) between 1 and 80),
	CONSTRAINT "shopping_items_aisle_key_check" CHECK ("shopping_items"."aisle_key" in ('produce', 'bakery', 'butcherFish', 'dairyEggs', 'pantrySavory', 'pantrySweet', 'drinks', 'household', 'hygiene', 'babyPets', 'frozen', 'other'))
);
--> statement-breakpoint
ALTER TABLE "shopping_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rev" bigint DEFAULT 0 NOT NULL,
	"channel_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "shopping_lists_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "shopping_lists_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "shopping_lists_name_check" CHECK (char_length(btrim("shopping_lists"."name")) between 1 and 80),
	CONSTRAINT "shopping_lists_rev_check" CHECK ("shopping_lists"."rev" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shopping_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shopping_aisle_order" ADD CONSTRAINT "shopping_aisle_order_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_aisle_overrides" ADD CONSTRAINT "shopping_aisle_overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_list_fk" FOREIGN KEY ("workspace_id","list_id") REFERENCES "public"."shopping_lists"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_items_workspace_list_idx" ON "shopping_items" USING btree ("workspace_id","list_id");--> statement-breakpoint
CREATE POLICY "shopping_aisle_order_select" ON "shopping_aisle_order" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("shopping_aisle_order"."workspace_id") and "shopping_aisle_order"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_aisle_order_insert" ON "shopping_aisle_order" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("shopping_aisle_order"."workspace_id") and "shopping_aisle_order"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_aisle_order_update" ON "shopping_aisle_order" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("shopping_aisle_order"."workspace_id") and "shopping_aisle_order"."user_id" = app.current_user_id()) WITH CHECK (app.is_workspace_member("shopping_aisle_order"."workspace_id") and "shopping_aisle_order"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_aisle_overrides_select" ON "shopping_aisle_overrides" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("shopping_aisle_overrides"."workspace_id") and "shopping_aisle_overrides"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_aisle_overrides_insert" ON "shopping_aisle_overrides" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("shopping_aisle_overrides"."workspace_id") and "shopping_aisle_overrides"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_aisle_overrides_update" ON "shopping_aisle_overrides" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("shopping_aisle_overrides"."workspace_id") and "shopping_aisle_overrides"."user_id" = app.current_user_id()) WITH CHECK (app.is_workspace_member("shopping_aisle_overrides"."workspace_id") and "shopping_aisle_overrides"."user_id" = app.current_user_id());--> statement-breakpoint
CREATE POLICY "shopping_items_select" ON "shopping_items" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("shopping_items"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_items_insert" ON "shopping_items" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("shopping_items"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_items_update" ON "shopping_items" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("shopping_items"."workspace_id")) WITH CHECK (app.is_workspace_member("shopping_items"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_items_delete" ON "shopping_items" AS PERMISSIVE FOR DELETE TO "app_backend" USING (app.is_workspace_member("shopping_items"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_lists_select" ON "shopping_lists" AS PERMISSIVE FOR SELECT TO "app_backend" USING (app.is_workspace_member("shopping_lists"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_lists_insert" ON "shopping_lists" AS PERMISSIVE FOR INSERT TO "app_backend" WITH CHECK (app.is_workspace_member("shopping_lists"."workspace_id"));--> statement-breakpoint
CREATE POLICY "shopping_lists_update" ON "shopping_lists" AS PERMISSIVE FOR UPDATE TO "app_backend" USING (app.is_workspace_member("shopping_lists"."workspace_id")) WITH CHECK (app.is_workspace_member("shopping_lists"."workspace_id"));

-- rev tenu par la base : le GRANT UPDATE (rev) laisse l'app l'écrire, ce trigger ne l'autorise qu'inchangé
-- ou en +1 (un recul rendrait les clients aveugles, une valeur extrême ferait échouer rev + 1 pour tout
-- le workspace). Même forme qu'app.set_updated_at : SECURITY INVOKER, search_path vide, aucun GRANT requis.
CREATE FUNCTION app.guard_shopping_rev() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF NEW.rev IS DISTINCT FROM OLD.rev AND NEW.rev IS DISTINCT FROM OLD.rev + 1 THEN
    RAISE EXCEPTION 'shopping_lists.rev ne peut qu''avancer de 1' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.guard_shopping_rev() FROM PUBLIC;
--> statement-breakpoint

-- updated_at tenu par la base (fonction de 0005, SECURITY INVOKER, aucun GRANT requis).
--> statement-breakpoint
CREATE TRIGGER shopping_lists_guard_rev BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION app.guard_shopping_rev();
--> statement-breakpoint
CREATE TRIGGER shopping_lists_set_updated_at BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER shopping_items_set_updated_at BEFORE UPDATE ON public.shopping_items
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER shopping_aisle_overrides_set_updated_at BEFORE UPDATE ON public.shopping_aisle_overrides
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER shopping_aisle_order_set_updated_at BEFORE UPDATE ON public.shopping_aisle_order
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Droits d'app_backend, par colonne. Jamais fixés par l'app : id, created_at, updated_at, channel_id
-- (défaut aléatoire), added_by_guest (fonctions d'invité, PR B), user_id (défaut = utilisateur connecté,
-- donc personne n'écrit pour un autre). workspace_id : posé à la création, jamais modifié ; list_id aussi.
-- shopping_lists : pas de DELETE (une liste par workspace). rev : incrémenté par chaque écriture.
GRANT SELECT ON public.shopping_lists TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, name) ON public.shopping_lists TO app_backend;
--> statement-breakpoint
GRANT UPDATE (name, rev) ON public.shopping_lists TO app_backend;
--> statement-breakpoint

-- shopping_items : se coche, se renomme, se reclasse, se supprime (DELETE : vider les cochés).
GRANT SELECT, DELETE ON public.shopping_items TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, list_id, label, aisle_key, aisle_pinned, checked_at) ON public.shopping_items TO app_backend;
--> statement-breakpoint
GRANT UPDATE (label, aisle_key, aisle_pinned, checked_at) ON public.shopping_items TO app_backend;
--> statement-breakpoint

-- Corrections et ordre des rayons : se lisent, s'écrivent (upsert), ne se suppriment pas.
GRANT SELECT ON public.shopping_aisle_overrides TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, keyword, aisle_key) ON public.shopping_aisle_overrides TO app_backend;
--> statement-breakpoint
GRANT UPDATE (aisle_key) ON public.shopping_aisle_overrides TO app_backend;
--> statement-breakpoint
GRANT SELECT ON public.shopping_aisle_order TO app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, aisle_keys) ON public.shopping_aisle_order TO app_backend;
--> statement-breakpoint
GRANT UPDATE (aisle_keys) ON public.shopping_aisle_order TO app_backend;
