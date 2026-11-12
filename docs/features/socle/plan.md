# Plan — Socle

**Spec** : `spec.md` · **Branche** : `feat/socle` · **Créé le** : 2026-11-11 · **Révisé le** : 2026-11-11 (ADR-006 à 009, Sentry) · **Tickets** : BRAIN-2 à BRAIN-7

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = security-auditor passe après le reviewer. -->
<!-- [manuel] = action dans Neon ou Vercel, faite par la session principale (MCP) après accord d'Antoine, ou par Antoine. L'implementer n'a pas accès à ces comptes. -->

## Décisions prises dans ce plan
- **Identité transmise à la base** (question 1 de la spec, ADR-002) : jeton de Neon Auth. Le serveur vérifie la signature du jeton (`jose` + JWKS de Neon Auth), puis, dans une transaction ouverte avec le rôle restreint, injecte les claims vérifiés via `set_config('request.jwt.claims', …, true)`, précédé d'un appel d'amorçage `select app.current_user_id()` (sinon `pg_session_jwt`, chargée au premier appel d'un backend neuf, efface les claims locaux). Après `set_config`, `withUserDb` vérifie `app.current_user_id() = sub` et lève `IdentityNotAppliedError` sinon ; le claim `role` injecté vaut toujours `authenticated`. Les policies passent par `app.current_user_id()` et `app.is_workspace_member()`, fonctions `SECURITY DEFINER` sur `auth.uid()` (uuid) : le schéma `auth` appartient à `cloud_admin` et reste inaccessible à `app_backend` (GRANT ignoré). Une seule fonction fait cette injection : `withUserDb()` dans `src/db/client.ts` (fabrique testable dans `src/db/user-db.ts`). Source : doc Neon « Run RLS queries with Drizzle ORM », vérifiée le 2026-11-11.
  - Précision : en mode serveur, c'est le serveur qui vérifie la signature, pas la base. La garantie vient de ce qu'un seul point du code injecte une identité, et seulement depuis un jeton vérifié.
- **Deux connexions** : `DATABASE_URL` (propriétaire, migrations et seed uniquement) et `DATABASE_AUTHENTICATED_URL` (rôle `app_backend`, LOGIN, sans BYPASSRLS). Le rôle est créé dans Neon (mot de passe hors du code) ; ses droits (GRANT) sont posés par migration.
- **Connexions de test** : une branche Neon de test, deux URL. `DATABASE_TEST_URL` (propriétaire) prépare les deux workspaces ; `DATABASE_TEST_AUTHENTICATED_URL` (rôle `app_backend`) exécute les assertions d'isolation. Jamais `main`.
- **Appartenance sans récursion** : les policies appellent `app.is_workspace_member(workspace_id)`, fonction `SECURITY DEFINER`, `search_path` figé, propriétaire = rôle des migrations.
- **Lien utilisateur** : `workspace_members.user_id uuid` = identifiant de l'utilisateur Neon Auth (`neon_auth.user.id`, uuid ; `sub` du jeton). Les policies le comparent à `app.current_user_id()` (SECURITY DEFINER sur `auth.uid()`, uuid ; schéma `auth` inaccessible à `app_backend`). Vérifié sur `dev` le 2026-11-12.
- **Performance RLS** : `is_workspace_member` est appelée par ligne (SECURITY DEFINER non inlinée) ; acceptable au socle. Pour un module volumineux, passer à `workspace_id IN (SELECT app.member_workspace_ids())`.
- **Workspace d'un utilisateur multi-workspace** : `getWorkspaceForUser` renvoie le plus ancien workspace d'un utilisateur multi-workspace ; choix du workspace actif à trancher au multi-comptes (BRAIN-26).
- **Rôles owner/member** : la base ne les distingue pas encore (tout membre peut tout faire dans son workspace) ; à trancher au multi-comptes (BRAIN-26).
- **Extension `pg_session_jwt`** : fournit `auth.uid()` / `auth.user_id()`, qui lisent `request.jwt.claims` posé par `set_config` (vérifié sur `dev`). Absente par défaut : `CREATE EXTENSION IF NOT EXISTS pg_session_jwt` dans la migration custom de la tâche 6.
- **Projet Neon** : `bemybrain` (Francfort, Postgres 18), branches `production`, `dev` (local), `test` (tests d'isolation). Rôle `app_backend` créé sur `production` (LOGIN, sans BYPASSRLS, sans appartenance à `neon_superuser`) et hérité par `dev` et `test`.
- **Choix Privé / Pro et filtre de contexte** : cookies lus côté serveur (`bmb_side`, `bmb_contexts`). Préférence d'affichage, pas une donnée métier.
- **Langue** (ADR-007) : `next-intl` sans routage i18n. Source de vérité : `workspace_members.locale` ; recopiée dans le cookie `NEXT_LOCALE` à la connexion et au changement, lu par `src/i18n/request.ts`. Avant connexion : `Accept-Language`, puis `fr`.
- **Animation** (ADR-006) : Motion pour interactions et changements d'état ; GSAP pour les moments signature, dans `src/components/signature/`, chargés par `next/dynamic`. Un élément n'est jamais animé par les deux. Gestes répétés instantanés.
- **Mobile** (ADR-008) : mobile d'abord, PWA installable via `src/app/manifest.ts`, pas de service worker. Logique métier dans `src/modules/` uniquement, sans import de React ni de Next.
- **Inscription publique** : désactivée dans la config Neon Auth de chaque branche ; le compte d'Antoine est créé à la main.
- **Domaine** : sous-domaine Vercel. L'URL publique n'existe que dans les variables d'environnement.
- **Thème** : clair d'abord, couleurs en tokens pour le sombre plus tard (révisé le 2026-11-12 : référence visuelle validée par Antoine, `docs/design/references/dashboard-desktop.dc.html` et `dashboard-mobile.dc.html`, source https://claude.ai/artifact/KrmtB4BtQbq1DKpdy7YULD).
- **Région** : Neon et Vercel déjà à Francfort (ADR-005). Projet Sentry en région UE.
- **Erreurs** : `@sentry/nextjs` dans l'app ; alertes vers un canal Slack par réglage Sentry (aucun code). Aucune donnée personnelle envoyée (`sendDefaultPii: false`, pas de corps de requête).
- **Registre d'actions** (ADR-009) : `src/modules/actions/`, sans React ni Next. Chaque action : `name`, `description` (clé i18n), `params` (zod), `access` (`read`/`write`), `run(ctx, params)`. La palette passe par une Server Action unique.
- **Cache Components** : non adopté dans le socle (lecture de cookies serveur partout, app derrière login) ; à réévaluer à Next 17.
- **Fuseau horaire** : `Europe/Brussels` pour tous (src/i18n/config.ts) ; fuseau par utilisateur à prévoir au passage multi-comptes (BRAIN-26).
- **Textes hors JSX** (toast, erreurs de Server Action, chaînes dans des .ts) : couverts par revue jusqu'à la tâche 20, où la convention « toast et erreurs ne reçoivent que t(...) » sera testée.
- **Primitives UI** : shadcn/ui en style `base-nova` (Base UI, pas Radix), défaut actuel de shadcn ; à confirmer avant la tâche 12. Vérifier à la tâche 20 que le composant Command existe en base-nova (sinon `cmdk` seul).
- **Limitation de tentatives** : règle de rate limit du pare-feu Vercel sur les POST vers /login et /reset-password (tâche 17), la limite par IP de Neon Auth ne voyant que les IP de Vercel.
- **Réinitialisation** : OTP par e-mail ; plan B si le type forget-password n'est pas servi : `requestPasswordReset` par lien + domaine de confiance par environnement.
- **e2e avec connexion** : cookies `__Secure-` refusés par WebKit sur http://localhost → e2e connectés en Chromium (émulation iPhone) en local, WebKit contre une preview HTTPS ; à appliquer à partir de la tâche 14.

## Dépendances nouvelles (justification, constitution 7)
- `next`, `react`, `tailwindcss`, shadcn/ui — ADR-001.
- `drizzle-orm`, `drizzle-kit` — ADR-001.
- `@neondatabase/serverless` — pilote Neon requis pour les transactions de `withUserDb()`.
- `jose` — vérification du jeton Neon Auth par JWKS.
- `@neon/auth` (0.8.2, SDK officiel Neon Auth, vérifié le 2026-11-12 ; l'ancien nom `@neondatabase/auth` est figé en 0.7.0-beta) — ADR-003.
- `zod` — validation des entrées (règle `neon.md`).
- `next-intl` — ADR-007.
- `motion` — ADR-006, interactions.
- `gsap`, `@gsap/react` — ADR-006, moments signature.
- `vitest`, `@playwright/test` — CLAUDE.md.
- `tsx` — exécute `scripts/seed.ts` (imports sans extension, que le type stripping natif de Node refuse). Déjà dans l'arbre via `drizzle-kit` et `vite`, même version : déclaré en direct, aucun paquet ajouté.
- `@testing-library/react`, `jsdom` — tests de composants avec Vitest (`frontend.md`, tâche 2).
- `@testing-library/dom` — dépendance pair de `@testing-library/react`.
- `prettier` — appelé par le hook PostToolUse sur chaque fichier édité.
- `@types/node` ^24 — Node 24 LTS sur Vercel, exigé par vitest 5.
- `@tailwindcss/turbopack` — loader Tailwind v4 pour Turbopack (scaffold Next).
- Via shadcn init (ADR-001) : `@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `shadcn`, `tw-animate-css` (ce dernier limité aux primitives de `src/components/ui/`, cf. ADR-006).
- `@sentry/nextjs` — remontée des erreurs (demande d'Antoine du 2026-11-11).
- `cmdk` (via le composant Command de shadcn/ui) — palette de commandes : clavier, recherche et accessibilité déjà résolus.
- Aucune bibliothèque PWA (ADR-008) ; aucune bibliothèque pour le test des textes en dur (API `typescript` déjà présente).

## Tâches

- [x] **1. Adapter le kit à Neon + Drizzle et aux ADR 006–009** (BRAIN-2)
  - Fichiers : `.claude/agents/security-auditor.md`, `.claude/agents/explorer.md`, `.claude/skills/feature/SKILL.md`, `.claude/rules/frontend.md`, `.claude/rules/tests.md`, `docs/features/_template/plan.md`, `docs/instructions-projet-claude-ai.md`, `docs/gotchas.md`
  - Contenu : RLS Neon (`auth.user_id()`, rôle restreint, `app.is_workspace_member`) ; `[security]` sur `drizzle/`, `src/db/`, l'auth et la session ; `frontend.md` passe à `paths: src/app/**, src/components/**`, retire TanStack Query, react-hook-form et Vite, ajoute : textes via `next-intl` uniquement, Motion / GSAP selon ADR-006, aucune règle métier dans un composant ; `tests.md` remplace `supabase start` par « branche Neon de test via `DATABASE_TEST_URL` » ; `gotchas.md` retire la ligne Edge Function et ajoute le hook eslint (tâche 2).
  - Test : `grep -ril supabase . --exclude-dir=.git` ne renvoie que : l'ADR-001, l'ADR-003, `CLAUDE.md` (garde-fou « Pas de Supabase »), `docs/features/socle/plan.md` (texte de cette tâche) et `docs/instructions-projet-claude-ai.md` (outils Nexxia hors BeMyBrain).
  - Fini quand : la recherche est propre et le security-auditor décrit le modèle Neon de ce plan.

- [x] **2. Créer l'app Next.js et l'outillage** (BRAIN-4)
  - Fichiers : `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`
  - Ordre imposé : scaffold (`pnpm create next-app`, App Router, TS, Tailwind, `src/`) et `pnpm install` en Bash **avant** toute édition de `.ts` — le hook PostToolUse lance eslint et bloque tant qu'il n'est pas installé. Ajouter `node_modules/`, `.next/`, `test-results/`, `playwright-report/` à `.gitignore`. Initialiser shadcn/ui. Scripts : `dev`, `test`, `lint`, `typecheck`, `e2e`.
  - Frontières (ADR-002, ADR-008) dans `eslint.config.mjs`, règle `no-restricted-imports` : `src/app/**` et `src/components/**` n'importent ni `drizzle-orm` ni `@/db/*` ; `src/modules/**` n'importe ni `react` ni `next/*`.
  - Test à écrire d'abord : `src/app/page.test.tsx` — « affiche la page d'accueil sans erreur » ; `tests/lint/boundaries.test.ts` — « eslint refuse un import de @/db dans un composant ».
  - Fini quand : `pnpm lint`, `pnpm typecheck`, `pnpm test` passent.

- [x] **3. Poser le multilingue FR/EN** (ADR-007)
  - Fichiers : `src/i18n/request.ts`, `src/i18n/locales.ts`, `messages/fr.json`, `messages/en.json`, `next.config.ts` (plugin next-intl), `src/app/layout.tsx`, `tests/i18n/no-hardcoded-text.test.ts`, `tests/i18n/messages-parity.test.ts`
  - `next-intl` sans routage i18n (doc officielle « without i18n routing »). Locale lue dans le cookie `NEXT_LOCALE`, sinon `Accept-Language`, sinon `fr` ; valeur hors `fr`/`en` ignorée. `<html lang>` suit la locale.
  - Test « texte en dur » : parcourt `src/**/*.tsx` avec l'API `typescript`, échoue sur tout `JSXText` non vide et sur tout littéral dans `aria-label`, `title`, `alt`, `placeholder`. Liste d'exceptions explicite et vide au départ.
  - Test à écrire d'abord : « échoue sur un composant de test contenant un texte en dur » ; « fr.json et en.json ont exactement les mêmes clés » ; « un cookie NEXT_LOCALE=de retombe sur fr » ; « une même date s'affiche « 11 novembre 2026 » en fr et « November 11, 2026 » en en ».
  - Fini quand : tests verts, la page d'accueil de la tâche 2 passe par les messages.

- [x] **4. Créer le projet Neon et le rôle restreint** [manuel]
  - Actions : nouveau projet Neon `bemybrain` (Francfort ; ne pas toucher `my-first-project`), branche `production` (défaut Neon), branche `dev` pour le local ; activer Neon Auth sur `production` ; rôle `app_backend` (LOGIN, sans BYPASSRLS) ; vérifier que `auth.user_id()` répond.
  - Antoine met les connexions dans son `.env` local (jamais dans le chat ni le repo).
  - Fini quand : `DATABASE_URL`, `DATABASE_AUTHENTICATED_URL`, `NEON_AUTH_*` existent pour `dev`, et `auth.user_id()` répond sur `dev`.

- [x] **5. Brancher Drizzle, les migrations et `.env.example`** (BRAIN-4)
  - Fichiers : `drizzle.config.ts`, `src/db/client.ts`, `src/db/user-db.ts`, `src/db/admin.ts`, `src/db/schema/app.ts`, `src/env.ts`, `.env.example`, `drizzle/0000_*.sql`, `package.json` (scripts `db:generate` et `db:migrate` avec drizzle-kit)
  - `src/env.ts` valide les variables avec zod au premier accès (l'app n'exige jamais `DATABASE_URL`). `src/db/client.ts` expose `withUserDb(token, fn)` (vérifie le jeton — signature JWKS, EdDSA, `exp`, `sub` uuid —, ouvre la transaction `app_backend`, injecte les claims vérifiés). L'injection testable (`createWithUserDb`, `createTokenVerifier`) vit dans `src/db/user-db.ts` ; `adminDb` (propriétaire, migrations et seed) dans `src/db/admin.ts`. eslint interdit `db/admin` et `db/user-db` hors de `src/db`, des scripts et des tests. `db:migrate` = commande unique, la même partout.
  - En test, `vitest.config.mts` fait pointer `DATABASE_URL` et `DATABASE_AUTHENTICATED_URL` sur la branche test (ou les supprime).
  - `.env.example` liste aussi, sans valeur, `DATABASE_TEST_URL` (propriétaire, branche de test) et `DATABASE_TEST_AUTHENTICATED_URL` (`app_backend`, branche de test), utilisées par les tests d'isolation (tâche 6).
  - Test à écrire d'abord : `src/env.test.ts` — « refuse de démarrer si DATABASE_AUTHENTICATED_URL manque » ; `src/db/client.test.ts` — « refuse un jeton à la signature invalide sans ouvrir de transaction ».
  - Fini quand : `pnpm db:migrate` passe sur `dev`, tests verts, aucune URL ni identifiant de projet dans le code (`grep` sur `neon.tech`, `vercel.app`).

- [x] **6. Tables `workspaces`, `workspace_members`, `contexts` avec RLS** [security] (BRAIN-6)
  - Fichiers : `src/db/schema/core.ts`, `tests/db/isolation-core.test.ts`, `tests/factories/core.ts`, script `db:migrate:test` (`MIGRATION_TARGET=test`).
  - Migrations (une fonction `LANGUAGE sql` vérifie son corps à la création : tables, puis fonctions, puis policies) :
    - `0001_core_tables` (générée) : tables, CHECK, index, FK, `ENABLE ROW LEVEL SECURITY` ;
    - `0002_rls_functions_and_grants` (custom) : `pg_session_jwt`, `app.current_user_id()` et `app.is_workspace_member()`, REVOKE PUBLIC sur `public`, `app` et les fonctions, GRANT au plus juste à `app_backend` (verbes sans GRANT commentés « refusé par absence de GRANT ») ;
    - `0003_core_policies` (générée) : une policy par verbe autorisé, `TO app_backend` ;
    - `0004_contexts_unique_name` (générée) : unique `(workspace_id, name)` sur `contexts` ;
    - `0005_updated_at_and_column_grants` (custom) : trigger `updated_at` sur les trois tables, INSERT/UPDATE par colonne sur `contexts`, droits par défaut des fonctions sans EXECUTE pour PUBLIC.
  - Colonnes selon `neon.md`. `contexts.kind` : `text` + `CHECK (kind IN ('private','pro'))`. `workspace_members.role` : `text` + `CHECK (role IN ('owner','member'))`. `workspace_members.locale` : `text NOT NULL DEFAULT 'fr'` + `CHECK (locale IN ('fr','en'))`. Index sur chaque FK et `(workspace_id, kind)`. RLS activée dans la même migration que chaque `CREATE TABLE`, une policy par verbe pour `app_backend`, jamais `FOR ALL` ni `USING (true)`. Un membre ne modifie que sa propre ligne (`locale`).
  - Test à écrire d'abord : `tests/db/isolation-core.test.ts` (données préparées via `DATABASE_TEST_URL`, assertions via `DATABASE_TEST_AUTHENTICATED_URL` en `app_backend`, claims posés à la main, aucun filtre applicatif) — « l'utilisateur du workspace B ne lit aucune ligne du workspace A », « ne peut ni insérer, ni modifier, ni supprimer chez A », « sans claims, ne lit rien », « ne peut pas modifier la locale d'un autre membre ».
  - Fini quand : les tests passent et la migration s'applique à neuf sur une branche vide.

- [x] **7. Script de départ rejouable** (BRAIN-6)
  - Fichiers : `scripts/seed.ts`, `scripts/seed.test.ts`, `package.json` (script `db:seed` = `tsx scripts/seed.ts`), `vitest.config.mts` (inclut `scripts/**/*.test.ts`).
  - `seedWorkspace(db, { ownerUserId })` : retrouve le workspace par l'appartenance owner de `SEED_OWNER_USER_ID`, sinon crée le workspace « BeMyBrain » (nom générique), l'appartenance owner (locale `fr`) et les contextes de `DEFAULT_CONTEXTS` (Privé `private` 0, Trustup `pro` 1, Nexxia `pro` 2). Une transaction, verrou consultatif par propriétaire (testé : deux seeds simultanés, un seul workspace). Erreur de la base : message générique + SQLSTATE. Les noms de contextes sont du contenu utilisateur : non traduits. Aucune donnée personnelle dans le code.
  - Contextes posés seulement à la création du workspace (pas d'`ON CONFLICT` à chaque passage) : un contexte renommé, réordonné ou supprimé n'est jamais recréé ni remis en place. Le seed ne modifie jamais une ligne existante.
  - CLI : `.env` chargé, garde-fou `NEON_PRODUCTION_HOST` (même que `drizzle.config.ts`), `SEED_OWNER_USER_ID` validé uuid, puis seulement ouverture d'`adminDb`. `MIGRATION_TARGET` refusée (`adminDb` lit toujours `DATABASE_URL`). Erreurs de la base : message générique.
  - Tests : `scripts/seed.test.ts` contre la branche test (`DATABASE_TEST_URL`) — « lancé deux fois, le seed produit un workspace et trois contextes », « ne recrée pas un contexte renommé ni ne remet en place un contexte réordonné », « un second utilisateur owner obtient son propre workspace », refus d'un uuid invalide ou absent, de la production en local, de `MIGRATION_TARGET`.
  - Seed sur `dev` après la tâche 9 (le compte d'Antoine, donc `SEED_OWNER_USER_ID`, n'existe qu'à ce moment) ; seed de production par la CI (ADR-010, tâche 17).

- [x] **8. Module `core` : lectures et écritures filtrées** [security] (BRAIN-6)
  - Fichiers : `src/modules/core/queries.ts`, `src/modules/core/mutations.ts`, `src/modules/core/core.test.ts`
  - Lectures : `getWorkspaceForUser`, `listContexts(workspaceId, { side })`, `getMemberLocale(workspaceId, userId)`. Écriture : `setMemberLocale(workspaceId, userId, locale)` (locale validée par zod). Chaque fonction prend `workspaceId` en premier argument, filtre dessus, passe par `withUserDb`, n'importe ni React ni Next. Toute création de workspace par le module core pose elle-même les contextes (le seed ne les recrée pas).
  - Test à écrire d'abord : « `listContexts` côté Pro renvoie Trustup et Nexxia, pas Privé » ; « un workspaceId étranger renvoie une liste vide » ; « `setMemberLocale` refuse `de` ».
  - Fini quand : tests verts.

- [x] **9. Configurer Neon Auth** [manuel] [security] (BRAIN-5)
  - Déjà fait le 2026-11-12 sur `production`, `dev` et `test` : inscription publique fermée, connexion Google partagée retirée.
  - Fait le 2026-11-12 : `localhost` retiré des origines autorisées sur `production` (gardé sur `dev`) ; compte d'Antoine créé sur `production` (id `2326061b-1e88-46fe-beac-eb0df219eb85`) et sur `dev` (id `9cdcc14d-5d44-45b5-8d8d-47d90a99652f`), sans mot de passe : défini par « mot de passe oublié » (code par e-mail) à la tâche 10 ; seed passé sur `dev` (workspace BeMyBrain, Privé / Trustup / Nexxia), rejoué sans doublon. L'id de production servira de `SEED_OWNER_USER_ID` au seed lancé par GitHub Actions (tâche 17).
  - Reste (tâche 17) : domaine de confiance = URL Vercel de production ; vérifier qu'une preview hérite bien du compte de `production`.
  - Prévu à l'origine : domaines de confiance = localhost et l'URL Vercel ; créer le compte d'Antoine sur `production` et sur `dev` ; vérifier si une branche preview hérite des utilisateurs de `production` (ADR-003). Si non, prévoir pour `/qa` un compte de test créé sur la branche preview.
  - Fini quand : Antoine se connecte sur `dev` via Neon Auth et la réponse au point « preview » est notée dans `docs/gotchas.md`.

- [x] **10. Écran de connexion et session serveur** [security] (BRAIN-5)
  - Fichiers : `src/lib/auth/` (`server.ts` : `getAuth`, `getSession`, `getSessionToken` ; `actions.ts` : actions serveur ; `routes.ts` ; `schemas.ts`), `src/proxy.ts` (convention Next 16, remplace `middleware.ts`), `src/app/(auth)/login/page.tsx`, `src/app/(auth)/reset-password/page.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/components/auth/`, `messages/*.json`
  - Toute route sans session valide → redirection vers `/login` (proxy, puis second verrou dans le layout de `(app)`). Publiques : `/login`, `/reset-password`, `/manifest.webmanifest`, `/icons` ; les assets statiques sont hors du matcher. Pas de lien d'inscription. Messages d'erreur génériques, traduits. Écran conçu à 390 px d'abord.
  - Connexion, déconnexion et réinitialisation passent par des actions serveur (`@neon/auth/next/server`) : pas de client navigateur, pas de route `/api/auth` montée (l'API d'inscription n'est pas exposée par l'app).
  - Réinitialisation par code e-mail : `emailOtp.sendVerificationOtp({ type: "forget-password" })` puis `emailOtp.resetPassword` ; crée le mot de passe d'un compte qui n'en a pas (Better Auth 1.7). Réponse identique que le compte existe ou non.
  - Cookies du SDK : `__Secure-neon-auth.*`, toujours `HttpOnly` et `Secure`, `sameSite: "lax"` posé explicitement (la doc Neon annonce `strict`, le code 0.8.2 applique `lax`).
  - Jeton : `iss` et `aud` vérifiés, figés par `NEON_AUTH_ISSUER` et `NEON_AUTH_AUDIENCE` (= origine de `NEON_AUTH_BASE_URL`, doc Neon « JWT » du 2026-11-05 ; pas de vrai jeton décodé : aucun compte avec mot de passe à ce stade). JWT obtenu par `auth.token()` (endpoint `/token`), jamais `session.token` (jeton opaque). Aucune route n'appelle encore `withUserDb`.
  - Faits : `src/db/client.test.ts` (« refuse un iss étranger », « refuse une audience étrangère », « refuse un jeton sans audience ») ; `src/proxy.test.ts` (« laisse passer /login, /manifest.webmanifest et les icônes, redirige /dashboard sans session », cookie forgé, matcher) ; `e2e/acces-refuse.spec.ts` (scénario 3, desktop, vert contre `pnpm dev`).
  - Lecture de session sûre dans un Server Component : `getSession` / `getSessionToken` passent par une instance `createAuthServer` (`@neon/auth/server`) dont l'écriture de cookie ignore la seule erreur « cookies en lecture seule » de Next ; le proxy porte le renouvellement. Journal serveur des échecs d'auth : statut HTTP et code Neon seulement. 5xx et 429 → « service indisponible ». La déconnexion efface les cookies `__Secure-neon-auth.*` quoi qu'il arrive.
  - Reste : connexion réelle d'Antoine sur `dev` (définir le mot de passe par « mot de passe oublié ») ; connexion réelle, attendre > 5 min, recharger /dashboard : ni 500 ni double appel ; puis décoder un vrai jeton (`iss`, `aud`, `alg`, `kid` seulement) pour confirmer `NEON_AUTH_ISSUER` / `NEON_AUTH_AUDIENCE` ; vérifier sur `dev` que l'API d'inscription de Neon Auth refuse et que l'Email OTP est actif.
  - Fini quand : tests verts, connexion réelle d'Antoine sur `dev`.

- [ ] **11. Résoudre le workspace et la langue depuis la session** [security] (BRAIN-5, BRAIN-6)
  - Fichiers : `src/lib/session.ts`, `src/lib/locale-cookie.ts`
  - `requireSession()` renvoie `{ userId, workspaceId, token }` depuis la session serveur uniquement. Utilisateur sans workspace → page d'erreur sobre, pas de création automatique. À la connexion, la locale du membre est recopiée dans `NEXT_LOCALE`. Réévaluer `server-only` sur `src/lib/auth/`.
  - Audit tâche 10 (2026-11-12) : le layout `(app)` n'est pas un second verrou complet (pas réexécuté en navigation client ; une Server Action ne passe pas par lui ; une action est appelable par POST sur une page publique). `requireSession()` est donc appelée par chaque page de `(app)`, chaque lecture de données et au début de chaque Server Action non publique ; le `ctx` du registre (tâche 20) en est issu. Le `userId` vient du `sub` du JWT vérifié par `withUserDb` (jamais du cache de session de `getSession()`, croyable jusqu'à 5 min). Tests : « une Server Action non publique appelée sans session est refusée » ; « le userId du ctx est celui du JWT ».
  - Test à écrire d'abord : « sans session, lève une redirection vers /login » ; « un utilisateur sans appartenance n'obtient aucun workspace » ; « après connexion, le cookie NEXT_LOCALE vaut la locale enregistrée ».
  - Fait (2026-11-12) : `withUserDb(token, (tx, { userId }) => …)` expose le `sub` vérifié ; `src/modules/core/membership.ts` (`resolveMembership(token)` : `getMembership`, workspace + langue en une requête), car `src/lib` n'importe pas `@/db` (eslint) ; `requireSession()` = `cache(loadSession)` de React (par requête, jamais partagé ; hors rendu, pas de mémoïsation), renvoie `{ userId, workspaceId, workspaceName }` (sans jeton ; `requireSessionToken()`, même cache, sert le JWT aux seuls appelants serveur), redirige vers `/login` (pas de session) ou `/no-workspace` (page hors de `(app)`, pas de boucle) ; Neon Auth indisponible (5xx, 429, réseau) → `AuthUnavailableError` (dans `getSession` comme dans `getSessionToken`), page d'erreur `src/app/error.tsx` (texte fixe traduit, bouton réessayer), jamais `/login` ; `withUserDb` relance les erreurs de contrôle de Next (`unstable_rethrow`). Même fonction pour les Server Actions : `redirect` interrompt l'action. `requireSession` n'écrit aucun cookie : NEXT_LOCALE (httpOnly, lax, `/`, 1 an, Secure en prod) est recopié par `signIn` via `syncSessionLocale()` (JWT demandé avec les cookies que la connexion vient de poser : `getCookies` lit `cookies()` de Next, reformé puis passé au parseur du SDK). `server-only` (fourni par Next, aucun paquet) sur `src/lib/auth/server.ts`, `src/lib/session.ts`, `src/lib/locale-cookie.ts`. `tests/lint/server-actions.test.ts` : toute valeur exportée d'un fichier `"use server"` et toute action en ligne commence par `await requireSession()` (ou `const … = await requireSession()`), sauf `signIn`, `signOut`, `requestPasswordReset`, `resetPassword` listées par nom ; `requireSession` doit être l'import de `@/lib/session` ; `export let`/`var` refusés ; fichiers `.(c|m)?(j|t)sx?`. `/` redirige vers `/dashboard`, qui affiche le nom du workspace.
  - Reste : Antoine recharge /dashboard connecté sur `dev` et voit « Espace de travail : BeMyBrain » (premier vrai JWT passé à `withUserDb`) ; puis se déconnecte / reconnecte et vérifie que NEXT_LOCALE est posé.
  - Fini quand : tests verts.

- [ ] **12. Écrire PRODUCT.md et DESIGN.md** (BRAIN-3)
  - Fichiers : `PRODUCT.md`, `DESIGN.md`, `src/app/globals.css` (tokens)
  - Skill `nexxia-design` + Impeccable, références `docs/design/references/`. Référence validée : `docs/design/references/dashboard-*.dc.html` (thème clair). À reprendre : verre dépoli clair (blanc ~58 %, flou 24 px, saturation 150 %, bord blanc 75 %, ombre bleutée douce) sur fond brume bleu-lilas (`#E8ECF5` + halos flous `#AFC0F4` / `#D6C6F2`) ; texte `#1B2033`, secondaire `#535A72` ; une seule tuile pleine indigo (`#3D4FD6`) pour « Aujourd'hui » ; rayons 24 px (barre mobile 30 px, pilules) ; Inter (texte) + Space Grotesk (titres, chiffres) via `next/font`. Tokens prêts pour un thème sombre. Fixe couleurs, typo (lisible en FR et EN, textes anglais plus courts, français plus longs), rayons, effets de verre, grille bento (mobile d'abord : 1 colonne à 390 px, puis tablette, puis desktop), zones tactiles ≥ 44 px, navigation au pouce. Mouvement : liste des moments signature GSAP et des interactions Motion (ADR-006), durées et easings. Icône d'app et couleur de thème pour la PWA.
  - Test : pas de test unitaire (document) ; contrôle `references/anti-slop.md` du skill.
  - Fait (2026-11-12) : `PRODUCT.md`, `DESIGN.md` (palette de la référence et contrastes calculés, typo, rayons, verre, grille bento, composants, mouvement, PWA, stratégie du sombre, 9 décisions hors référence au § 8 à valider) ; `src/app/globals.css` (tokens + `@theme`, mappés sur les variables shadcn, fond brume + halos, `prefers-reduced-motion` et `prefers-reduced-transparency`, utilitaire `glass`, neutres du scaffold et bloc `.dark` retirés) ; `src/app/layout.tsx` (Inter + Space Grotesk via `next/font`, `viewport.themeColor`) ; `src/lib/theme.ts` (couleurs PWA) ; `tests/design/tokens.test.ts` (tokens clés, aucune couleur hors référence). Impeccable absent de l'environnement : `/impeccable document` à repasser. `viewportFit: cover` laissé à la tâche 13.
  - Fini quand : Antoine valide DESIGN.md.

- [ ] **13. Rendre l'app installable (PWA)** (ADR-008)
  - Fichiers : `src/app/manifest.ts`, `public/icons/` (192, 512, maskable, apple-touch-icon 180), `src/app/layout.tsx` (métadonnées `appleWebApp`, `viewport`, `themeColor`)
  - `display: standalone`, `start_url: /dashboard`, nom et description de l'app tirés des messages de la locale par défaut. Zones sûres iOS (`env(safe-area-inset-*)`) gérées dans la coque.
  - Test à écrire d'abord : `src/app/manifest.test.ts` — « le manifeste déclare standalone, une icône 192, une 512 et une maskable » ; `e2e/installation.spec.ts` (scénario 5) — « /manifest.webmanifest répond 200 sans session et chaque icône déclarée existe ».
  - Fini quand : tests verts, audit d'installabilité Chrome (Lighthouse PWA ou DevTools > Application) sans erreur sur la preview.
  - Fait (2026-11-12) : `src/app/manifest.ts` (statique ; textes `app.*` de `messages/fr.json` via `createTranslator` de next-intl, sans lire la requête ; `lang: fr`, `scope: /`, couleurs `THEME_COLOR` / `BACKGROUND_COLOR` de `src/lib/theme.ts`) ; icônes `public/icons/` (192, 512, maskable 512, apple-touch-icon 180 opaque) et `src/app/favicon.ico` (32 px, PNG dans un ICO), dérivées de `docs/design/icon.svg` par `node scripts/generate-icons.mjs` (Chromium de Playwright, aucune dépendance) ; `layout.tsx` : `appleWebApp` (capable, titre, `statusBarStyle: default`), `icons.apple`, `viewportFit: cover` ; `globals.css` : `--safe-top/right/bottom/left` + utilitaires `pt-safe-top`… (DESIGN.md § 9), appliqués par la coque à la tâche 14. Tests : `src/app/manifest.test.ts`, `e2e/installation.spec.ts` (desktop), chemins publics ajoutés à `src/proxy.test.ts` (déjà couverts par le matcher). Audit local (Chromium 158 headless, profil persistant, CDP) : `Page.getAppManifest` sans erreur, `Page.getInstallabilityErrors` vide. Revue (2026-11-12) : test séparé de l'icône 512 « any » et de la maskable, icône Apple 180 opaque testée, couleurs de `docs/design/icon.svg` testées contre la palette, script qui rend le SVG source tel quel (PNG identiques octet pour octet).
  - État : code fait ; reste l'essai d'installation sur preview HTTPS, iPhone (Safari) et Android (Chrome), après la tâche 17.

- [ ] **14. Coque : navigation et bascule Privé / Pro** (BRAIN-7)
  - Référence (2026-11-12) : barre latérale gauche avec catégories dépliables sur ordinateur ; bascule Privé / Pro en haut ; sur mobile, barre d'onglets en bas avec le bouton d'ajout au centre (bouton rond indigo, sans action dans le socle hors palette, cf. tâche 20).
  - Fichiers : `src/app/(app)/layout.tsx`, `src/components/shell/`, `src/components/signature/side-switch.tsx`, `src/lib/preferences.ts`
  - Navigation au pouce (barre basse sur mobile, latérale sur desktop). Bascule Privé / Pro ; côté Pro, filtre Trustup / Nexxia / les deux. État dans les cookies `bmb_side` et `bmb_contexts`, lus côté serveur, validés par zod (valeur inconnue → Privé). Interactions en Motion ; l'effet signature de la bascule en GSAP, dans son composant chargé à la demande, joué une seule fois par session : les bascules suivantes sont instantanées.
  - Test à écrire d'abord : `src/lib/preferences.test.ts` — « une valeur de cookie inconnue retombe sur Privé » ; `e2e/bascule-prive-pro.spec.ts` (scénario 2, desktop + mobile) ; « la deuxième bascule ne déclenche aucune animation ».
  - Fini quand : tests verts.

- [ ] **15. Tableau de bord bento et moments signature** (BRAIN-7)
  - Fichiers : `src/app/(app)/dashboard/page.tsx`, `src/components/bento/`, `src/components/signature/dashboard-intro.tsx`, `src/components/signature/bento-reveal.tsx`, `src/components/signature/empty-state.tsx`
  - Tuiles vides typées par côté et par contexte ; seules celles du côté actif s'affichent. Mobile d'abord : une colonne à 390 px. GSAP pour l'entrée du tableau de bord, la révélation de la grille, les effets de verre et les écrans vides, via `next/dynamic` ; Motion pour le survol et l'apparition des tuiles. Aucun élément partagé entre les deux. `gsap.matchMedia` et `useReducedMotion` coupent tout sous `prefers-reduced-motion`.
  - Test à écrire d'abord : `e2e/premiere-connexion.spec.ts` (scénario 1, desktop + mobile) ; test composant — « côté Pro, aucune tuile Privé n'est rendue » ; e2e avec `reducedMotion: 'reduce'` — « aucune animation ne démarre » ; test de build — « gsap n'est pas dans le bundle initial de /dashboard ».
  - Fini quand : tests verts, anti-slop puis `/impeccable critique` passés.

- [ ] **16. Réglages : choix de la langue** (BRAIN-7, ADR-007)
  - Fichiers : `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/actions.ts`, `src/components/settings/locale-picker.tsx`
  - Server Action : `requireSession()` → `setMemberLocale` → `syncLocaleCookie(locale)` (`src/lib/locale-cookie.ts` : c'est cette action, avec `signIn`, qui recopie NEXT_LOCALE ; `requireSession` ne l'écrit jamais) → rafraîchissement. URL inchangée.
  - Test réel à écrire (première action non publique) : « une Server Action non publique appelée sans session est refusée ».
  - Test à écrire d'abord : `e2e/changer-de-langue.spec.ts` (scénario 4, desktop + mobile) — « après passage en anglais, rechargement et reconnexion, l'interface est en anglais (`html[lang="en"]`) et une date s'affiche au format anglais ».
  - Fini quand : tests verts.

- [ ] **17. Vercel, previews et CI** [manuel] + code (BRAIN-4)
  - Manuel : projet Vercel existant (Francfort) relié au repo, production sur `main`, intégration Neon (une branche Neon par preview), variables par environnement. Production : `pnpm db:migrate` par GitHub Actions au merge dans `main`, avant le déploiement ; accès propriétaire de prod uniquement en secret GitHub (environnement protégé), jamais dans Vercel (ADR-010). Previews : migration de leur propre branche, aussi par la CI. Intégration Neon–Vercel configurée pour ne pousser aucune variable propriétaire au runtime Vercel : seulement `DATABASE_AUTHENTICATED_URL` et `NEON_AUTH_*` (ADR-010).
  - Manuel (auth) : ajouter `NEON_AUTH_COOKIE_SECRET` à la main dans Vercel, un par environnement (`openssl rand -base64 32`), avec `NEON_AUTH_ISSUER` et `NEON_AUTH_AUDIENCE` (origine de `NEON_AUTH_BASE_URL` de la branche) ; règle de rate limit du pare-feu Vercel sur les POST vers /login et /reset-password, posée avant toute URL de production partagée (audit tâche 10). `revoke_sessions_on_password_reset` activé sur `dev` et `test` le 2026-11-12 ; sur `production`, à activer par Antoine (refusé à l'agent).
  - Code (audit tâche 10) : en-têtes de sécurité via `headers()` dans `next.config.ts` — CSP avec `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimale ; test qui vérifie leur présence sur `/login`.
  - Code : `.github/workflows/ci.yml` — lint, typecheck, tests unitaires (dont textes en dur et parité des clés), tests d'isolation sur une branche Neon créée pour le run puis supprimée.
  - Test : ouvrir une pull request de contrôle.
  - Essai d'installation (reste de la tâche 13, scénario 5 de `/qa`) : sur la preview HTTPS, ajout à l'écran d'accueil sur iPhone (Safari) et Android (Chrome) ; l'app s'ouvre en plein écran sur /login puis /dashboard, icône et nom corrects, barre d'état lisible. Vérifier le plein écran iOS : s'il est absent, ajouter `apple-mobile-web-app-capable` via `metadata.other` (Next 16 n'émet que `mobile-web-app-capable`). Audit d'installabilité Chrome (DevTools > Application) sans erreur.
  - Fini quand : la PR a sa preview, sa branche Neon et une CI verte ; `main` déploie en production.
  - Préparé (2026-11-12, code seulement, rien poussé ni exécuté contre Neon ou Vercel ; durci après audit le même jour) :
    - `src/lib/security-headers.ts` : CSP à nonce posée par `src/proxy.ts` sur chaque page (sans nonce, Next 16 bloque ses propres scripts en ligne ; toutes les pages sont rendues à la demande), `script-src 'self' 'nonce-…' 'strict-dynamic'`, styles par nonce en production (`style-src-attr 'unsafe-inline'` pour les attributs `style`), `connect-src 'self'` (Neon Auth côté serveur seulement ; Sentry, tâche 19, ajoutera son point d'ingestion), polices `next/font` auto-hébergées ; `next.config.ts` `headers()` : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS au build de production. Tests : `src/lib/security-headers.test.ts`, `tests/security/next-config-headers.test.ts`, `src/proxy.test.ts`, `e2e/en-tetes-securite.spec.ts` ; les e2e accès refusé et installation échouent sur toute violation de CSP (`e2e/csp.ts`). Vérifié aussi contre `pnpm build && pnpm start`.
    - À garder en tête : HSTS porte `includeSubDomains`, à revoir au passage à un domaine personnalisé (sous-domaines non HTTPS) ; les chemins à extension (`.png`, `.webmanifest`…) ne passent pas par le proxy, donc ni CSP ni contrôle de session : à revoir si une route attrape-tout arrive.
    - `scripts/ci/neon-branch.mjs` (testé), utilisé par les trois workflows : crée ou retrouve une branche `ci/…` ou `preview/…` (refuse tout autre nom, et toute branche par défaut ou protégée), attend la fin des opérations Neon, puis **réinitialise sur cette branche les mots de passe de `neondb_owner` et d'`app_backend`** (`POST /projects/{id}/branches/{branch_id}/roles/{role}/reset_password`, doc Neon « Manage roles ») : aucun mot de passe hérité du parent n'est utilisé ni stocké dans GitHub. Masque endpoint (`ep-…`, avec et sans `-pooler`), hôtes, mots de passe et URL avant d'écrire `$GITHUB_ENV`. Remplace `neondatabase/create-branch-action` (v6.3.1 vérifiée), dont les sorties ne sont pas masquées.
    - `.github/workflows/ci.yml` (PR et push sur `main`) : lint, types, build ; puis branche `ci/run-<id>-<essai>` fille de **`test`** (aucune donnée réelle ; variable de dépôt `NEON_CI_PARENT_BRANCH` pour changer), expirée sous 2 h, `pnpm db:migrate:test`, `pnpm test`, suppression même en échec ou annulation. `NEON_API_KEY` n'existe que dans les deux étapes `neon-branch.mjs`. PR de fork : échec explicite (le check requis ne passe pas).
    - `.github/workflows/migrate-production.yml` (push sur `main`, environnement `production`) : `pnpm db:migrate` puis `pnpm db:seed`. Ordre avec Vercel : Deployment Check GitHub sur le job « Migrer la production » (doc Vercel « Deployment Checks », 2026-08-11) : Vercel construit, mais n'attribue le domaine de production qu'après la migration réussie. Aucun secret Vercel.
    - Le Deployment Check est contournable : « Force Promote » d'un déploiement, `vercel deploy --prod` en CLI, Instant Rollback vers un déploiement plus ancien (qui tournera alors sur le schéma migré). D'où la règle « migrations rétrocompatibles » de `.claude/rules/neon.md` : ajouter d'abord, retirer dans un déploiement suivant.
    - `.github/workflows/preview-database.yml` : à chaque push de PR, crée ou retrouve `preview/<branche-git>` (fille de `production`, ADR-005), réinitialise ses mots de passe, expiration 10 jours repoussée à chaque push, `pnpm db:migrate` ; la supprime à la fermeture. PR de fork : échec explicite.
  - Incohérence à trancher avant les previews : l'intégration Neon–Vercel (doc Neon « Neon-Managed », 2026-10-23) n'injecte que `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PG*` (rôle choisi à la connexion) et `NEON_AUTH_BASE_URL` ; les noms ne sont pas configurables. Elle ne peut donc pas fournir `DATABASE_AUTHENTICATED_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`, `NEON_AUTH_AUDIENCE`, et l'app refuse `DATABASE_URL` sur Vercel (ADR-010). Options : (A, recommandée) pas d'intégration ; la CI de preview pose aussi ces variables sur Vercel, limitées à la branche git (API Vercel, secret `VERCEL_TOKEN`), puis redéploie ; (B) intégration + app qui dérive l'URL `app_backend` et les `NEON_AUTH_*` : met l'URL propriétaire au runtime des previews, contraire à ADR-010 ; (C) previews sur une base partagée : contraire à ADR-005.
  - Risque résiduel à faire accepter par Antoine dans ADR-010 au moment du choix A/B/C : toute personne ayant l'écriture sur le dépôt peut modifier un workflow et faire tourner son code avec `NEON_API_KEY` (création, réinitialisation, suppression de branches du projet). Limites : clé limitée au projet `bemybrain`, `production` protégée dans Neon, `DATABASE_URL` de production seulement dans l'environnement `production` (branches de déploiement : `main`).
  - Reste, dans l'ordre (Antoine, ou la session principale après accord) :
    1. Neon : **protéger la branche `production`** (empêche suppression et reset ; les branches filles reçoivent de nouveaux mots de passe). Fonction des formules payantes (Launch : 2 branches protégées, Scale : 5 ; doc Neon « Protected branches ») ; sur la formule gratuite, impossible : le noter dans ADR-010. Noter le nom de la base et du rôle propriétaire (défauts du script : `neondb`, `neondb_owner`).
    2. Neon : vérifier que la branche `test` porte le journal `drizzle.__drizzle_migrations` avec les migrations 0000 à 0005 (`select count(*) from drizzle.__drizzle_migrations` sur `test`) ; non vérifié par l'implementer (lecture de la base refusée par les permissions). `db:migrate:test` applique ensuite les migrations plus récentes que la dernière du journal.
    3. Neon : clé d'API **limitée au projet `bemybrain`** (clé de projet, pas clé personnelle ni d'organisation).
    4. GitHub, secrets du dépôt : `NEON_API_KEY`, `NEON_PROJECT_ID`. Variables du dépôt, seulement si différentes des défauts : `NEON_DATABASE`, `NEON_OWNER_ROLE`, `NEON_CI_PARENT_BRANCH`. **`DATABASE_URL` ne doit jamais exister comme secret de dépôt.**
    5. GitHub, environnement `production` : branches de déploiement limitées à `main` ; secret `DATABASE_URL` (propriétaire de `production`, depuis 1Password) ; variable `SEED_OWNER_USER_ID` = id du compte d'Antoine sur `production` (tâche 9).
    6. GitHub : protection de `main` exigeant les checks « Lint, types et build » et « Tests (branche Neon éphémère) », avec « Do not allow bypassing the above settings ».
    7. Vercel : projet existant relié au dépôt, région Francfort (`fra1`), branche de production `main`.
    8. Vercel, variables Production (à la main) : `DATABASE_AUTHENTICATED_URL` (`app_backend` sur `production`), `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER` et `NEON_AUTH_AUDIENCE` (origine de `NEON_AUTH_BASE_URL`), `NEON_AUTH_COOKIE_SECRET` (`openssl rand -base64 32`, propre à la production). Jamais `DATABASE_URL`.
    9. Vercel : Deployment Checks > GitHub > « Migrer la production » ; aliasing automatique de la production activé (prérequis de la doc). Vérifier que la fonction existe sur la formule du compte ; sinon : `git.deploymentEnabled.main = false` dans `vercel.json` + Deploy Hook de production appelé par le workflow après la migration, secret `VERCEL_DEPLOY_HOOK_PRODUCTION` rangé dans l'**environnement** `production`, pas au niveau du dépôt.
    10. Previews : trancher l'option A, B ou C ci-dessus (aucune intégration Neon–Vercel à installer avant ce choix). Option A : secret `VERCEL_TOKEN`, variables `VERCEL_PROJECT_ID` et `VERCEL_TEAM_ID`, `NEON_AUTH_COOKIE_SECRET` de preview posé à la main, puis compléter `preview-database.yml`.
    11. Vercel, pare-feu : règle de rate limit sur les POST vers `/login` et `/reset-password` (par IP), avant de partager l'URL de production.
    12. Neon Auth sur `production` : activer `revoke_sessions_on_password_reset` (Antoine) ; domaine de confiance = URL Vercel de production.
    13. Pousser `feat/socle`, ouvrir une PR de contrôle : CI verte, branche `ci/run-…` créée puis supprimée, `preview/feat/socle` migrée, aucun hôte, endpoint ni URL en clair dans les journaux ; confirmer que `reset_password` passe sur `app_backend` (rôle créé en SQL).
    14. Merge dans `main` : « Migrer la production » vert, puis domaine de production attribué ; seed : « workspace déjà présent » ou créé une fois.
    15. Essai d'installation iPhone (Safari) et Android (Chrome) sur l'URL HTTPS de production, audit d'installabilité Chrome.

- [ ] **18. Vérifier la restauration de la production** [manuel] (BRAIN-4)
  - Actions : après le seed de production, restaurer la branche Neon `production` à un instant passé sur une branche de test, lire le workspace d'Antoine, supprimer la branche. Noter la fenêtre de restauration de la formule Neon.
  - Fini quand : procédure et date de vérification écrites dans un runbook dans `docs/`.

- [ ] **19. Brancher Sentry et l'alerte Slack** [manuel] + code (BRAIN-4)
  - Code : `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/global-error.tsx`, `next.config.ts` (`withSentryConfig`), `.env.example` (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN` pour les source maps, `SENTRY_ENVIRONMENT`). DSN par variable uniquement ; `sendDefaultPii: false` ; environnement = production ou preview.
  - Manuel : projet Sentry (région UE) ; intégration Slack de l'organisation Sentry ; règle d'alerte « nouvelle erreur ou régression en production » vers le canal Slack choisi par Antoine. Aucun code pour l'alerte.
  - Test à écrire d'abord : `src/lib/sentry-options.test.ts` — « sendDefaultPii est faux et l'environnement vient de la variable » ; « sans SENTRY_DSN, l'app démarre et n'envoie rien ».
  - Fini quand : une erreur volontaire sur une preview apparaît dans Sentry, et une erreur sur la production arrive dans le canal Slack.

- [ ] **20. Registre d'actions et palette de commandes** [security] (BRAIN-7, ADR-009)
  - Fichiers : `src/modules/actions/registry.ts`, `src/modules/actions/types.ts`, `src/modules/core/actions.ts`, `src/app/(app)/actions.ts` (Server Action unique `runAction`), `src/components/command-palette/`, `messages/*.json`
  - Registre sans React ni Next (règle eslint de la tâche 2). Actions du socle : `core.listContexts` (`read`), `core.setLocale` (`write`, réutilise `setMemberLocale`). `runAction(name, params)` : `requireSession()` → recherche dans le registre → validation zod → `run`. Nom inconnu ou paramètres invalides → erreur générique, rien d'exécuté. Les actions passent `userId = ctx.userId`, jamais un paramètre. Palette : ⌘K / Ctrl+K sur desktop, bouton dans la barre basse sur mobile ; navigation (tableau de bord, réglages) en raccourcis hors registre ; textes traduits ; ouverture en Motion.
  - Test à écrire d'abord : `src/modules/actions/registry.test.ts` — « chaque action déclare name, description, params et access » ; « deux actions ne partagent pas un name » ; « des paramètres invalides n'appellent pas run » ; « une action write sans workspaceId refuse de s'exécuter » ; `e2e/palette.spec.ts` — « depuis la palette, passer en anglais change la langue de l'interface ».
  - Fini quand : tests verts.

## Ordre et dépendances
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. La tâche 12 peut se faire à tout moment avant la 13. 12 → 13 → 14 → 15 → 16. 17 dès que 5 est fait, au plus tard avant `/qa`. 18 après le premier déploiement en production. 19 après 17. 20 après 16.

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
