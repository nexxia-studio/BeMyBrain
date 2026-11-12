---
paths:
  - "drizzle/**"
  - "src/db/**"
  - "src/modules/**/queries.ts"
  - "src/modules/**/mutations.ts"
  - "**/*.sql"
---
# Règles Neon / Postgres / Drizzle

- Toute table métier : `id uuid default gen_random_uuid()`, `workspace_id uuid NOT NULL REFERENCES workspaces(id)`, `created_at timestamptz default now()`, `updated_at timestamptz`.
- Accès aux données uniquement via `src/modules/<module>/queries.ts` (lectures) et `mutations.ts` (écritures). Chaque fonction prend `workspaceId` en premier argument et filtre dessus. Jamais de requête Drizzle dans un composant ou une route.
- Le `workspaceId` vient de la session serveur, jamais du client (paramètre d'URL, body, cookie lisible).
- Montants : `integer` suffixé `_cents`. Statuts : `text` + `CHECK (status IN (...))`, pas d'enum Postgres.
- Index : sur chaque FK, et sur `(workspace_id, <colonne filtrée>)` pour les listes.
- Migrations : générées par `pnpm db:generate`, un fichier par changement, jamais modifié après application. Rollback = nouvelle migration. `drizzle-kit push` interdit hors base locale.
- Migrations rétrocompatibles : la production est migrée avant que le nouveau code soit servi, et un ancien déploiement peut revenir (Instant Rollback, promotion forcée). Une migration ne casse jamais le code déjà déployé : ajouter d'abord (colonne nullable ou avec défaut, nouvelle table), retirer ou renommer dans un déploiement suivant, une fois plus aucun code ne l'utilise.
- Environnements : une branche Neon par preview Vercel. La branche `production` de Neon = production ; on n'y écrit jamais à la main.
- Routes appelées de l'extérieur (webhooks, exports Apple Santé, agrégateur bancaire) : valider le body avec zod, vérifier la signature ou le jeton avant tout, répondre vite et traiter ensuite.
- Liens de partage publics (ex. liste de courses) : jeton aléatoire long, révocable, limité à une ressource. Jamais l'identifiant de la ressource seul.
- RLS (ADR-002) : `ENABLE ROW LEVEL SECURITY` dans la même migration que `CREATE TABLE`. Une policy par verbe (SELECT / INSERT / UPDATE / DELETE), jamais `FOR ALL`, jamais `USING (true)`. Filtre : appartenance de l'utilisateur connecté au `workspace_id` de la ligne. Policies déclarées dans le schéma Drizzle (`pgPolicy` / `crudPolicy`).
- L'app se connecte avec le rôle restreint soumis à la RLS. Le rôle propriétaire (`DATABASE_URL` des migrations) ne sert jamais à répondre à une requête utilisateur.
- Test d'isolation obligatoire par module : deux workspaces, lecture et écriture croisées refusées au niveau de la base.
