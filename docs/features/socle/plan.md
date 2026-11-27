# Plan — Socle

**Spec** : `spec.md` · **Branche** : `feat/socle` · **Créé le** : 2026-11-11 · **Révisé le** : 2026-11-18 (socle clos : tâches 1 à 21 et QA-1, QA-2 dans « Terminé » ; PR #7 fusionnée, `main` à `20c1fce`) — 2026-11-12 (tâches 1 à 10 closes, previews option A ADR-010, projet Vercel à créer) — 2026-11-11 (ADR-006 à 009, Sentry) · **Tickets** : BRAIN-2 à BRAIN-7

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
- **Choix Privé / Pro et filtre de contexte** : cookies lus côté serveur (`bmb_side`, `bmb_contexts_private`, `bmb_contexts_pro`). Préférence d'affichage, pas une donnée métier.
- **Langue** (ADR-007) : `next-intl` sans routage i18n. Source de vérité : `workspace_members.locale` ; recopiée dans le cookie `NEXT_LOCALE` à la connexion et au changement, lu par `src/i18n/request.ts`. Avant connexion : `Accept-Language`, puis `fr`.
- **Animation** (ADR-006) : Motion pour interactions et changements d'état ; GSAP pour les moments signature, dans `src/components/signature/`, chargés par `next/dynamic`. Un élément n'est jamais animé par les deux. Gestes répétés instantanés.
- **Mobile** (ADR-008) : mobile d'abord, PWA installable via `src/app/manifest.ts`, pas de service worker. Logique métier dans `src/modules/` uniquement, sans import de React ni de Next.
- **Inscription publique** : désactivée dans la config Neon Auth de chaque branche ; le compte d'Antoine est créé à la main.
- **Domaine** : sous-domaine Vercel. L'URL publique n'existe que dans les variables d'environnement.
- **Thème** : clair d'abord, couleurs en tokens pour le sombre plus tard (révisé le 2026-11-12 : référence visuelle validée par Antoine, `docs/design/references/dashboard-desktop.dc.html` et `dashboard-mobile.dc.html`, source https://claude.ai/artifact/KrmtB4BtQbq1DKpdy7YULD).
- **Région** : Neon et Vercel déjà à Francfort (ADR-005). Projet Sentry en région UE.
- **Erreurs** : `@sentry/nextjs` dans l'app ; alertes de production par e-mail par réglage Sentry (aucun code ; Slack écarté le 2026-11-18, intégration payante, cf. BRAIN-27). Aucune donnée personnelle envoyée (`sendDefaultPii: false`, pas de corps de requête).
- **Registre d'actions** (ADR-009) : `src/modules/actions/`, sans React ni Next. Chaque action : `name`, `description` (clé i18n), `params` (zod), `access` (`read`/`write`), `run(ctx, params)`. La palette passe par une Server Action unique.
- **Cache Components** : non adopté dans le socle (lecture de cookies serveur partout, app derrière login) ; à réévaluer à Next 17.
- **Fuseau horaire** : `Europe/Brussels` pour tous (src/i18n/config.ts) ; fuseau par utilisateur à prévoir au passage multi-comptes (BRAIN-26).
- **Textes hors JSX** (toast, erreurs de Server Action, chaînes dans des .ts) : convention « toast et erreurs ne reçoivent que t(...) ou une clé de message », testée depuis la tâche 20 par `tests/i18n/literal-messages.test.ts` (Server Actions et `src/components/**`).
- **Primitives UI** : shadcn/ui en style `base-nova` (Base UI, pas Radix), défaut actuel de shadcn ; à confirmer avant la tâche 12. Palette (tâche 20, 2026-11-16) : `Autocomplete` (en ligne, motif « command palette » de sa documentation) + `Dialog` de Base UI, déjà installé ; ni composant Command de shadcn ni `cmdk`, aucune dépendance ajoutée.
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
- Aucune bibliothèque PWA (ADR-008) ; aucune bibliothèque pour le test des textes en dur (API `typescript` déjà présente).

## Tâches

Aucune tâche ouverte : les tâches 1 à 21 et les corrections QA-1 et QA-2 sont dans « Terminé ». Socle clos le 2026-11-18.

## Ordre et dépendances
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. La tâche 12 peut se faire à tout moment avant la 13. 12 → 13 → 14 → 15 → 16. 17 dès que 5 est fait, au plus tard avant `/qa`. 18 après le premier déploiement en production. 19 après 17. 20 après 16. 21 après 17 (étape 11).

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. Corps des tâches 1 à 10 retirés le 2026-11-12 : historique dans `git log -p -- docs/features/socle/plan.md`. -->
- [x] **1. Adapter le kit à Neon + Drizzle et aux ADR 006–009** (BRAIN-2) — 2026-11-11, `42b5a84`
- [x] **2. Créer l'app Next.js et l'outillage** (BRAIN-4) — 2026-11-12, `8613531`
- [x] **3. Poser le multilingue FR/EN** (ADR-007) — 2026-11-12, `61a4bd6`
- [x] **4. Créer le projet Neon et le rôle restreint** [manuel] — 2026-11-12, `3dfdf6f`
- [x] **5. Brancher Drizzle, les migrations et `.env.example`** (BRAIN-4) — 2026-11-12, `ae0ae25`
- [x] **6. Tables `workspaces`, `workspace_members`, `contexts` avec RLS** [security] (BRAIN-6) — 2026-11-12, `5677038`, corrections `8d805b8`
- [x] **7. Script de départ rejouable** (BRAIN-6) — 2026-11-12, `443e6ed`
- [x] **8. Module `core` : lectures et écritures filtrées** [security] (BRAIN-6) — 2026-11-12, `49d3692`
- [x] **9. Configurer Neon Auth** [manuel] [security] (BRAIN-5) — 2026-11-12, validée par Antoine, `816828e`. Reste à la tâche 17 : domaine de confiance de production, héritage des comptes par les previews.
- [x] **10. Écran de connexion et session serveur** [security] (BRAIN-5) — 2026-11-12, validée par Antoine, `816828e`. Reste non noté comme fait : décoder un vrai jeton (`iss`, `aud`, `alg`, `kid` seulement) pour confirmer `NEON_AUTH_ISSUER` / `NEON_AUTH_AUDIENCE`.
- [x] **11. Résoudre le workspace et la langue depuis la session** [security] (BRAIN-5, BRAIN-6) — 2026-11-16, vérifiée par Antoine sur `dev`. Workspace choisi et langue par appartenance : BRAIN-26, BRAIN-30.
- [x] **12. Écrire PRODUCT.md et DESIGN.md** (BRAIN-3) — 2026-11-12. `/impeccable document` à repasser (plugin absent à l'époque).
- [x] **13. Rendre l'app installable (PWA)** (ADR-008) — 2026-11-17, iPhone validé sur la production (scénario 5 de `/qa`), audit Chrome sans erreur ; Android reporté avant le multi-comptes (BRAIN-26).
- [x] **14. Coque : navigation et bascule Privé / Pro** (BRAIN-7) — 2026-11-13, `c8a5b2e`, corrections `ee02fbc`.
- [x] **15. Tableau de bord bento et moments signature** (BRAIN-7) — 2026-11-16, `b7fc3a3`, corrections `4f42ffb`, `8acc43d`. Effets de verre animés reportés (BRAIN-33).
- [x] **16. Réglages : choix de la langue** [security] (BRAIN-7, ADR-007) — 2026-11-16, `0bb47cf`, corrections `33f8dc3`, `d8ffb5f`.
- [x] **17. Vercel, previews et CI** [manuel] + code (BRAIN-4) — 2026-11-18, PR #3 (`7826eb0`) et PR #4 (`a462ee7`). Limite : aucun Deployment Check actif, la production peut être mise en ligne avant la fin de sa migration ; parade = migrations rétrocompatibles (`.claude/rules/neon.md`) ; suite BRAIN-37 (réglé le 2026-11-27).
- [x] **18. Vérifier la restauration de la production** [manuel] (BRAIN-4) — 2026-11-18, `docs/runbooks/restauration-production.md`.
- [x] **19. Brancher Sentry et l'alerte e-mail** [security] [manuel] + code (BRAIN-4) — 2026-11-18, PR #5 (`3e5e4a4`) et PR #6 (`91caed4`). Alerte par e-mail (Slack écarté). Source maps : BRAIN-35. Deployment Check : BRAIN-37 (réglé le 2026-11-27).
- [x] **20. Registre d'actions et palette de commandes** [security] (BRAIN-7, ADR-009) — 2026-11-16, `cd6d023`, corrections `01dc658`, `b07d7fc`, `12dcec4`, `1182dc4` et suivants. Reports ouverts : rôle owner/member (avec la première action réservée à l'owner), projecteur de sortie, rate limit de `runAction` (pare-feu, tâche 17).
- [x] **21. Message « trop de tentatives » sur les formulaires de connexion** (BRAIN-5) — 2026-11-17, `b551d13`. `typedEmail` recopié dans les deux formulaires (à déplacer si la règle `"use server"` change).
- [x] **QA-1. Session expirée pendant une action → renvoi vers /login** [security] (QA socle du 2026-11-18) — 2026-11-18, `3d07d0c`, `1055914`, `f43eaf8`, `fe8e88f`, `1759064` ; reviewer et security-auditor OK. Cause : le proxy répondait 307 vers `/login` au POST de la Server Action (voir `docs/gotchas.md`).
- [x] **QA-2. /login ouvert en étant connecté → tableau de bord** (QA socle du 2026-11-18) — 2026-11-18, `123198a`, `5e6a27b` ; reviewer OK.
