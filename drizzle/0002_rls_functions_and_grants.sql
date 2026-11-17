-- Socle, tâche 6 (ADR-002) : identité, appartenance et droits d'app_backend sur les tables de 0001.
-- Les policies (0003) appellent les fonctions créées ici : elles viennent donc après.
-- Exécuté avec le rôle propriétaire des migrations, qui devient propriétaire des fonctions.

-- auth.uid() (uuid) lit request.jwt.claims posé par withUserDb (src/db/user-db.ts).
CREATE EXTENSION IF NOT EXISTS pg_session_jwt;
--> statement-breakpoint

-- Le schéma auth appartient à cloud_admin (Neon) : GRANT USAGE ON SCHEMA auth TO app_backend
-- est ignoré sans erreur. app_backend n'appelle donc jamais auth.* : il passe par ces deux fonctions
-- SECURITY DEFINER, exécutées par le propriétaire (qui a USAGE sur auth via pg_read_all_data).

-- Utilisateur connecté (sub des claims), NULL sans claims.
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT auth.uid() $$;
--> statement-breakpoint

-- L'utilisateur connecté est-il membre de ws ? Lit workspace_members en propriétaire (BYPASSRLS) :
-- pas de récursion des policies de workspace_members. Faux sans claims ou si ws est NULL.
CREATE FUNCTION app.is_workspace_member(ws uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = ws AND m.user_id = auth.uid()
  )
$$;
--> statement-breakpoint

-- Droits par défaut : PUBLIC n'a rien sur public, app ni ces fonctions.
-- Sans effet sur Neon Auth (rôle neon_auth, search_path = neon_auth, aucune dépendance vers public)
-- ni sur drizzle-kit (propriétaire, schéma drizzle).
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.is_workspace_member(uuid) FROM PUBLIC;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public, app TO app_backend;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id(), app.is_workspace_member(uuid) TO app_backend;
--> statement-breakpoint

-- workspaces : lecture seule pour l'app.
-- INSERT, UPDATE, DELETE : refusés par absence de GRANT (création par le seed propriétaire, tâche 7).
GRANT SELECT ON public.workspaces TO app_backend;
--> statement-breakpoint

-- workspace_members : lecture, et modification de la seule colonne locale (policy : sa propre ligne).
-- role, user_id, workspace_id, updated_at : non modifiables (UPDATE limité à locale).
-- INSERT, DELETE : refusés par absence de GRANT (appartenances posées par le seed propriétaire).
GRANT SELECT ON public.workspace_members TO app_backend;
--> statement-breakpoint
GRANT UPDATE (locale) ON public.workspace_members TO app_backend;
--> statement-breakpoint

-- contexts : les quatre verbes, filtrés par une policy chacun (0003).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contexts TO app_backend;
