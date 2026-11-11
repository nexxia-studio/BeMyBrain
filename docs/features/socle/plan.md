# Plan — Socle

**Spec** : `spec.md` · **Branche** : `feat/socle` · **Créé le** : 2026-11-11 · **Révisé le** : 2026-11-11 (ADR-006 à 009, Sentry) · **Tickets** : BRAIN-2 à BRAIN-7

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = security-auditor passe après le reviewer. -->
<!-- [manuel] = action dans Neon ou Vercel, faite par la session principale (MCP) après accord d'Antoine, ou par Antoine. L'implementer n'a pas accès à ces comptes. -->

## Décisions prises dans ce plan
- **Identité transmise à la base** (question 1 de la spec, ADR-002) : jeton de Neon Auth. Le serveur vérifie la signature du jeton (`jose` + JWKS de Neon Auth), puis, dans une transaction ouverte avec le rôle restreint, injecte les claims vérifiés via `set_config('request.jwt.claims', …, true)`. Les policies lisent `auth.user_id()`. Une seule fonction fait cette injection : `withUserDb()` dans `src/db/client.ts`. Source : doc Neon « Run RLS queries with Drizzle ORM », vérifiée le 2026-11-11.
  - Précision : en mode serveur, c'est le serveur qui vérifie la signature, pas la base. La garantie vient de ce qu'un seul point du code injecte une identité, et seulement depuis un jeton vérifié.
- **Deux connexions** : `DATABASE_URL` (propriétaire, migrations et seed uniquement) et `DATABASE_AUTHENTICATED_URL` (rôle `app_backend`, LOGIN, sans BYPASSRLS). Le rôle est créé dans Neon (mot de passe hors du code) ; ses droits (GRANT) sont posés par migration.
- **Connexions de test** : une branche Neon de test, deux URL. `DATABASE_TEST_URL` (propriétaire) prépare les deux workspaces ; `DATABASE_TEST_AUTHENTICATED_URL` (rôle `app_backend`) exécute les assertions d'isolation. Jamais `main`.
- **Appartenance sans récursion** : les policies appellent `app.is_workspace_member(workspace_id)`, fonction `SECURITY DEFINER`, `search_path` figé, propriétaire = rôle des migrations.
- **Lien utilisateur** : `workspace_members.user_id` = identifiant de l'utilisateur Neon Auth (`sub` du jeton). Type exact (`text` ou `uuid`) vérifié à la tâche 6 sur le schéma `neon_auth`.
- **Choix Privé / Pro et filtre de contexte** : cookies lus côté serveur (`bmb_side`, `bmb_contexts`). Préférence d'affichage, pas une donnée métier.
- **Langue** (ADR-007) : `next-intl` sans routage i18n. Source de vérité : `workspace_members.locale` ; recopiée dans le cookie `NEXT_LOCALE` à la connexion et au changement, lu par `src/i18n/request.ts`. Avant connexion : `Accept-Language`, puis `fr`.
- **Animation** (ADR-006) : Motion pour interactions et changements d'état ; GSAP pour les moments signature, dans `src/components/signature/`, chargés par `next/dynamic`. Un élément n'est jamais animé par les deux. Gestes répétés instantanés.
- **Mobile** (ADR-008) : mobile d'abord, PWA installable via `src/app/manifest.ts`, pas de service worker. Logique métier dans `src/modules/` uniquement, sans import de React ni de Next.
- **Inscription publique** : désactivée dans la config Neon Auth de chaque branche ; le compte d'Antoine est créé à la main.
- **Domaine** : sous-domaine Vercel. L'URL publique n'existe que dans les variables d'environnement.
- **Thème** : sombre d'abord, couleurs en tokens.
- **Région** : Neon et Vercel déjà à Francfort (ADR-005). Projet Sentry en région UE.
- **Erreurs** : `@sentry/nextjs` dans l'app ; alertes vers un canal Slack par réglage Sentry (aucun code). Aucune donnée personnelle envoyée (`sendDefaultPii: false`, pas de corps de requête).
- **Registre d'actions** (ADR-009) : `src/modules/actions/`, sans React ni Next. Chaque action : `name`, `description` (clé i18n), `params` (zod), `access` (`read`/`write`), `run(ctx, params)`. La palette passe par une Server Action unique.
- **Cache Components** : non adopté dans le socle (lecture de cookies serveur partout, app derrière login) ; à réévaluer à Next 17.
- **Primitives UI** : shadcn/ui en style `base-nova` (Base UI, pas Radix), défaut actuel de shadcn ; à confirmer avant la tâche 12. Vérifier à la tâche 20 que le composant Command existe en base-nova (sinon `cmdk` seul).

## Dépendances nouvelles (justification, constitution 7)
- `next`, `react`, `tailwindcss`, shadcn/ui — ADR-001.
- `drizzle-orm`, `drizzle-kit` — ADR-001.
- `@neondatabase/serverless` — pilote Neon requis pour les transactions de `withUserDb()`.
- `jose` — vérification du jeton Neon Auth par JWKS.
- SDK Neon Auth (nom exact du paquet vérifié à la tâche 10) — ADR-003.
- `zod` — validation des entrées (règle `neon.md`).
- `next-intl` — ADR-007.
- `motion` — ADR-006, interactions.
- `gsap`, `@gsap/react` — ADR-006, moments signature.
- `vitest`, `@playwright/test` — CLAUDE.md.
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

- [ ] **2. Créer l'app Next.js et l'outillage** (BRAIN-4)
  - Fichiers : `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`
  - Ordre imposé : scaffold (`pnpm create next-app`, App Router, TS, Tailwind, `src/`) et `pnpm install` en Bash **avant** toute édition de `.ts` — le hook PostToolUse lance eslint et bloque tant qu'il n'est pas installé. Ajouter `node_modules/`, `.next/`, `test-results/`, `playwright-report/` à `.gitignore`. Initialiser shadcn/ui. Scripts : `dev`, `test`, `lint`, `typecheck`, `e2e`.
  - Frontières (ADR-002, ADR-008) dans `eslint.config.mjs`, règle `no-restricted-imports` : `src/app/**` et `src/components/**` n'importent ni `drizzle-orm` ni `@/db/*` ; `src/modules/**` n'importe ni `react` ni `next/*`.
  - Test à écrire d'abord : `src/app/page.test.tsx` — « affiche la page d'accueil sans erreur » ; `tests/lint/boundaries.test.ts` — « eslint refuse un import de @/db dans un composant ».
  - Fini quand : `pnpm lint`, `pnpm typecheck`, `pnpm test` passent.

- [ ] **3. Poser le multilingue FR/EN** (ADR-007)
  - Fichiers : `src/i18n/request.ts`, `src/i18n/locales.ts`, `messages/fr.json`, `messages/en.json`, `next.config.ts` (plugin next-intl), `src/app/layout.tsx`, `tests/i18n/no-hardcoded-text.test.ts`, `tests/i18n/messages-parity.test.ts`
  - `next-intl` sans routage i18n (doc officielle « without i18n routing »). Locale lue dans le cookie `NEXT_LOCALE`, sinon `Accept-Language`, sinon `fr` ; valeur hors `fr`/`en` ignorée. `<html lang>` suit la locale.
  - Test « texte en dur » : parcourt `src/**/*.tsx` avec l'API `typescript`, échoue sur tout `JSXText` non vide et sur tout littéral dans `aria-label`, `title`, `alt`, `placeholder`. Liste d'exceptions explicite et vide au départ.
  - Test à écrire d'abord : « échoue sur un composant de test contenant un texte en dur » ; « fr.json et en.json ont exactement les mêmes clés » ; « un cookie NEXT_LOCALE=de retombe sur fr » ; « une même date s'affiche « 11 novembre 2026 » en fr et « November 11, 2026 » en en ».
  - Fini quand : tests verts, la page d'accueil de la tâche 2 passe par les messages.

- [ ] **4. Créer le projet Neon et le rôle restreint** [manuel]
  - Actions : projet Neon existant (Francfort), branche `main` = production, branche `dev` pour le local ; activer Neon Auth sur `main` ; rôle `app_backend` (LOGIN, sans BYPASSRLS) ; vérifier que `auth.user_id()` répond.
  - Antoine met les connexions dans son `.env` local (jamais dans le chat ni le repo).
  - Fini quand : `DATABASE_URL`, `DATABASE_AUTHENTICATED_URL`, `NEON_AUTH_*` existent pour `dev`, et `auth.user_id()` répond sur `dev`.

- [ ] **5. Brancher Drizzle, les migrations et `.env.example`** (BRAIN-4)
  - Fichiers : `drizzle.config.ts`, `src/db/client.ts`, `src/env.ts`, `.env.example`, `drizzle/0000_*.sql`, `package.json` (scripts `db:generate` et `db:migrate` avec drizzle-kit)
  - `src/env.ts` valide les variables avec zod au démarrage. `src/db/client.ts` expose `adminDb` (migrations, seed) et `withUserDb(token, fn)` (vérifie le jeton, ouvre la transaction, injecte les claims). `db:migrate` = commande unique, la même partout.
  - `.env.example` liste aussi, sans valeur, `DATABASE_TEST_URL` (propriétaire, branche de test) et `DATABASE_TEST_AUTHENTICATED_URL` (`app_backend`, branche de test), utilisées par les tests d'isolation (tâche 6).
  - Test à écrire d'abord : `src/env.test.ts` — « refuse de démarrer si DATABASE_AUTHENTICATED_URL manque » ; `src/db/client.test.ts` — « refuse un jeton à la signature invalide sans ouvrir de transaction ».
  - Fini quand : `pnpm db:migrate` passe sur `dev`, tests verts, aucune URL ni identifiant de projet dans le code (`grep` sur `neon.tech`, `vercel.app`).

- [ ] **6. Tables `workspaces`, `workspace_members`, `contexts` avec RLS** [security] (BRAIN-6)
  - Fichiers : `src/db/schema/core.ts`, `drizzle/0001_*.sql` (générée), `drizzle/0002_*.sql` (custom : fonction `app.is_workspace_member`, GRANT à `app_backend`, révocation des droits par défaut)
  - Colonnes selon `neon.md`. `contexts.kind` : `text` + `CHECK (kind IN ('private','pro'))`. `workspace_members.role` : `text` + `CHECK (role IN ('owner','member'))`. `workspace_members.locale` : `text NOT NULL DEFAULT 'fr'` + `CHECK (locale IN ('fr','en'))`. Index sur chaque FK et `(workspace_id, kind)`. RLS activée dans la même migration que chaque `CREATE TABLE`, une policy par verbe pour `app_backend`, jamais `FOR ALL` ni `USING (true)`. Un membre ne modifie que sa propre ligne (`locale`).
  - Test à écrire d'abord : `tests/db/isolation-core.test.ts` (données préparées via `DATABASE_TEST_URL`, assertions via `DATABASE_TEST_AUTHENTICATED_URL` en `app_backend`, claims posés à la main, aucun filtre applicatif) — « l'utilisateur du workspace B ne lit aucune ligne du workspace A », « ne peut ni insérer, ni modifier, ni supprimer chez A », « sans claims, ne lit rien », « ne peut pas modifier la locale d'un autre membre ».
  - Fini quand : les tests passent et la migration s'applique à neuf sur une branche vide.

- [ ] **7. Script de départ rejouable** (BRAIN-6)
  - Fichiers : `scripts/seed.ts`, `package.json` (script `db:seed`)
  - Crée le workspace, l'appartenance owner de l'utilisateur désigné par `SEED_OWNER_USER_ID`, et les contextes Privé (`private`), Trustup et Nexxia (`pro`). Les noms de contextes sont du contenu utilisateur : non traduits. Aucune donnée personnelle dans le code. Upsert : zéro doublon au second passage.
  - Test à écrire d'abord : `scripts/seed.test.ts` — « lancé deux fois, le seed produit un workspace et trois contextes ».
  - Fini quand : test vert, seed passé sur `dev`.

- [ ] **8. Module `core` : lectures et écritures filtrées** [security] (BRAIN-6)
  - Fichiers : `src/modules/core/queries.ts`, `src/modules/core/mutations.ts`, `src/modules/core/core.test.ts`
  - Lectures : `getWorkspaceForUser`, `listContexts(workspaceId, { side })`, `getMemberLocale(workspaceId, userId)`. Écriture : `setMemberLocale(workspaceId, userId, locale)` (locale validée par zod). Chaque fonction prend `workspaceId` en premier argument, filtre dessus, passe par `withUserDb`, n'importe ni React ni Next.
  - Test à écrire d'abord : « `listContexts` côté Pro renvoie Trustup et Nexxia, pas Privé » ; « un workspaceId étranger renvoie une liste vide » ; « `setMemberLocale` refuse `de` ».
  - Fini quand : tests verts.

- [ ] **9. Configurer Neon Auth** [manuel] [security] (BRAIN-5)
  - Actions : connexion e-mail + mot de passe, inscription publique désactivée, domaines de confiance = localhost et l'URL Vercel ; créer le compte d'Antoine sur `main` et sur `dev` ; vérifier si une branche preview hérite des utilisateurs de `main` (ADR-003). Si non, prévoir pour `/qa` un compte de test créé sur la branche preview.
  - Fini quand : Antoine se connecte sur `dev` via Neon Auth et la réponse au point « preview » est notée dans `docs/gotchas.md`.

- [ ] **10. Écran de connexion et session serveur** [security] (BRAIN-5)
  - Fichiers : `src/lib/auth/` (client et serveur Neon Auth), `src/app/(auth)/login/page.tsx`, `src/middleware.ts`, `src/app/(app)/layout.tsx`, `messages/*.json`
  - Toute route sous `(app)` sans session valide → redirection vers `/login`. Pas de lien d'inscription. Messages d'erreur génériques, traduits. Écran conçu à 390 px d'abord.
  - Test à écrire d'abord : `e2e/acces-refuse.spec.ts` (scénario 3) — « un visiteur non connecté qui ouvre /dashboard voit l'écran de connexion et rien d'autre » ; `src/middleware.test.ts` — « laisse passer /login, /manifest.webmanifest et les icônes, redirige /dashboard sans session ».
  - Fini quand : tests verts, connexion réelle d'Antoine sur `dev`.

- [ ] **11. Résoudre le workspace et la langue depuis la session** [security] (BRAIN-5, BRAIN-6)
  - Fichiers : `src/lib/session.ts`, `src/lib/locale-cookie.ts`
  - `requireSession()` renvoie `{ userId, workspaceId, token }` depuis la session serveur uniquement. Utilisateur sans workspace → page d'erreur sobre, pas de création automatique. À la connexion, la locale du membre est recopiée dans `NEXT_LOCALE`.
  - Test à écrire d'abord : « sans session, lève une redirection vers /login » ; « un utilisateur sans appartenance n'obtient aucun workspace » ; « après connexion, le cookie NEXT_LOCALE vaut la locale enregistrée ».
  - Fini quand : tests verts.

- [ ] **12. Écrire PRODUCT.md et DESIGN.md** (BRAIN-3)
  - Fichiers : `PRODUCT.md`, `DESIGN.md`, `src/app/globals.css` (tokens)
  - Skill `nexxia-design` + Impeccable, références `docs/design/references/`. Thème sombre, tokens prêts pour le clair. Fixe couleurs, typo (lisible en FR et EN, textes anglais plus courts, français plus longs), rayons, effets de verre, grille bento (mobile d'abord : 1 colonne à 390 px, puis tablette, puis desktop), zones tactiles ≥ 44 px, navigation au pouce. Mouvement : liste des moments signature GSAP et des interactions Motion (ADR-006), durées et easings. Icône d'app et couleur de thème pour la PWA.
  - Test : pas de test unitaire (document) ; contrôle `references/anti-slop.md` du skill.
  - Fini quand : Antoine valide DESIGN.md.

- [ ] **13. Rendre l'app installable (PWA)** (ADR-008)
  - Fichiers : `src/app/manifest.ts`, `public/icons/` (192, 512, maskable, apple-touch-icon 180), `src/app/layout.tsx` (métadonnées `appleWebApp`, `viewport`, `themeColor`)
  - `display: standalone`, `start_url: /dashboard`, nom et description de l'app tirés des messages de la locale par défaut. Zones sûres iOS (`env(safe-area-inset-*)`) gérées dans la coque.
  - Test à écrire d'abord : `src/app/manifest.test.ts` — « le manifeste déclare standalone, une icône 192, une 512 et une maskable » ; `e2e/installation.spec.ts` (scénario 5) — « /manifest.webmanifest répond 200 sans session et chaque icône déclarée existe ».
  - Fini quand : tests verts, audit d'installabilité Chrome (Lighthouse PWA ou DevTools > Application) sans erreur sur la preview.

- [ ] **14. Coque : navigation et bascule Privé / Pro** (BRAIN-7)
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
  - Server Action : `requireSession()` → `setMemberLocale` → mise à jour de `NEXT_LOCALE` → rafraîchissement. URL inchangée.
  - Test à écrire d'abord : `e2e/changer-de-langue.spec.ts` (scénario 4, desktop + mobile) — « après passage en anglais, rechargement et reconnexion, l'interface est en anglais et une date s'affiche au format anglais ».
  - Fini quand : tests verts.

- [ ] **17. Vercel, previews et CI** [manuel] + code (BRAIN-4)
  - Manuel : projet Vercel existant (Francfort) relié au repo, production sur `main`, intégration Neon (une branche Neon par preview), variables par environnement, `pnpm db:migrate` au build.
  - Code : `.github/workflows/ci.yml` — lint, typecheck, tests unitaires (dont textes en dur et parité des clés), tests d'isolation sur une branche Neon créée pour le run puis supprimée.
  - Test : ouvrir une pull request de contrôle.
  - Fini quand : la PR a sa preview, sa branche Neon et une CI verte ; `main` déploie en production.

- [ ] **18. Vérifier la restauration de la production** [manuel] (BRAIN-4)
  - Actions : après le seed de production, restaurer `main` à un instant passé sur une branche de test, lire le workspace d'Antoine, supprimer la branche. Noter la fenêtre de restauration de la formule Neon.
  - Fini quand : procédure et date de vérification écrites dans un runbook dans `docs/`.

- [ ] **19. Brancher Sentry et l'alerte Slack** [manuel] + code (BRAIN-4)
  - Code : `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/app/global-error.tsx`, `next.config.ts` (`withSentryConfig`), `.env.example` (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN` pour les source maps, `SENTRY_ENVIRONMENT`). DSN par variable uniquement ; `sendDefaultPii: false` ; environnement = production ou preview.
  - Manuel : projet Sentry (région UE) ; intégration Slack de l'organisation Sentry ; règle d'alerte « nouvelle erreur ou régression en production » vers le canal Slack choisi par Antoine. Aucun code pour l'alerte.
  - Test à écrire d'abord : `src/lib/sentry-options.test.ts` — « sendDefaultPii est faux et l'environnement vient de la variable » ; « sans SENTRY_DSN, l'app démarre et n'envoie rien ».
  - Fini quand : une erreur volontaire sur une preview apparaît dans Sentry, et une erreur sur la production arrive dans le canal Slack.

- [ ] **20. Registre d'actions et palette de commandes** [security] (BRAIN-7, ADR-009)
  - Fichiers : `src/modules/actions/registry.ts`, `src/modules/actions/types.ts`, `src/modules/core/actions.ts`, `src/app/(app)/actions.ts` (Server Action unique `runAction`), `src/components/command-palette/`, `messages/*.json`
  - Registre sans React ni Next (règle eslint de la tâche 2). Actions du socle : `core.listContexts` (`read`), `core.setLocale` (`write`, réutilise `setMemberLocale`). `runAction(name, params)` : `requireSession()` → recherche dans le registre → validation zod → `run`. Nom inconnu ou paramètres invalides → erreur générique, rien d'exécuté. Palette : ⌘K / Ctrl+K sur desktop, bouton dans la barre basse sur mobile ; navigation (tableau de bord, réglages) en raccourcis hors registre ; textes traduits ; ouverture en Motion.
  - Test à écrire d'abord : `src/modules/actions/registry.test.ts` — « chaque action déclare name, description, params et access » ; « deux actions ne partagent pas un name » ; « des paramètres invalides n'appellent pas run » ; « une action write sans workspaceId refuse de s'exécuter » ; `e2e/palette.spec.ts` — « depuis la palette, passer en anglais change la langue de l'interface ».
  - Fini quand : tests verts.

## Ordre et dépendances
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11. La tâche 12 peut se faire à tout moment avant la 13. 12 → 13 → 14 → 15 → 16. 17 dès que 5 est fait, au plus tard avant `/qa`. 18 après le premier déploiement en production. 19 après 17. 20 après 16.

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
