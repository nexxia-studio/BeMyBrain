-- Socle, tâche 6, corrections de revue : updated_at tenu par la base, écritures d'app_backend
-- sur contexts limitées aux colonnes métier, fonctions futures non exécutables par PUBLIC.

-- Droits par défaut des fonctions créées par le rôle des migrations (celui qui exécute ce fichier).
-- Forme globale, sans IN SCHEMA : des droits par défaut posés par schéma s'ajoutent aux droits
-- globaux sans pouvoir en retirer, et EXECUTE pour PUBLIC est global (vérifié sur test : avec
-- IN SCHEMA app, une fonction créée ensuite restait exécutable par PUBLIC).
-- Conséquence : toute fonction future de ce rôle, quel que soit son schéma, exige un GRANT EXECUTE explicite.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint

-- updated_at = now() à chaque UPDATE. SECURITY INVOKER : ne lit ni n'écrit rien d'autre que NEW.
-- Un trigger s'exécute sans droit EXECUTE ni droit sur la colonne pour l'appelant : app_backend
-- n'a donc besoin d'aucun GRANT ici, et ne peut pas fixer updated_at lui-même.
CREATE FUNCTION app.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
-- Déjà retiré par les droits par défaut ci-dessus ; explicite pour ne pas dépendre de l'ordre.
REVOKE ALL ON FUNCTION app.set_updated_at() FROM PUBLIC;
--> statement-breakpoint

CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER workspace_members_set_updated_at BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER contexts_set_updated_at BEFORE UPDATE ON public.contexts
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- contexts : INSERT et UPDATE par colonne (remplacent les GRANT globaux de 0002).
-- id, created_at, updated_at : jamais fixés par l'app. workspace_id : posé à la création
-- (WITH CHECK d'appartenance, 0003), jamais modifié ensuite (pas de déplacement entre workspaces).
-- SELECT et DELETE inchangés (0002).
REVOKE INSERT, UPDATE ON public.contexts FROM app_backend;
--> statement-breakpoint
GRANT INSERT (workspace_id, name, kind, position) ON public.contexts TO app_backend;
--> statement-breakpoint
GRANT UPDATE (name, kind, position) ON public.contexts TO app_backend;
