---
paths:
  - "supabase/**"
  - "**/*.sql"
---
# Règles Supabase / Postgres

- Toute table métier : `id uuid default gen_random_uuid()`, `gym_id uuid NOT NULL REFERENCES gyms(id)`, `created_at timestamptz default now()`. [adapter la clé tenant]
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` dans la même migration que `CREATE TABLE`. Une policy par verbe (SELECT / INSERT / UPDATE / DELETE), jamais `FOR ALL`.
- Policies : filtrer sur `gym_id = current_gym_id()` (fonction `security definer stable` qui lit `auth.jwt() -> 'app_metadata' ->> 'gym_id'`). Jamais `user_metadata` (modifiable par l'utilisateur), jamais `USING (true)`. [adapter le nom de la fonction]
- Montants : `integer` suffixé `_cents`. Statuts : `text` + `CHECK (status IN (...))`, pas d'enum Postgres (migration pénible).
- Index : sur chaque FK, sur `(gym_id, <colonne filtrée>)` pour les listes. Unique partiel pour « un seul actif » : `CREATE UNIQUE INDEX … WHERE status = 'active'`.
- Migrations : un fichier par changement, nommé `YYYYMMDDHHMMSS_<verbe>_<objet>.sql`, jamais modifié après application. Rollback = nouvelle migration.
- Edge Functions (Deno) : valider le body avec zod, vérifier le JWT sauf endpoint public déclaré `--no-verify-jwt` et justifié dans un commentaire d'en-tête. Webhooks : vérifier la signature avant tout.
- Après une migration : `supabase gen types typescript --local > src/types/database.ts`.
