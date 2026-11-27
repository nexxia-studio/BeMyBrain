# Handoff — état courant

**Dernière mise à jour** : 2026-11-28 — `/feature listes` sur `feat/listes` (spec validée, plan écrit), `main` à `6cc2a6d`

## Où on en est
- `main` : BRAIN-46 kanban livré (PR #15 données, PR #14 écrans) ; BRAIN-37 livré (PR #16, `6550b9f`). Tout est en production.
- BRAIN-37 : la CI migre puis déploie ; `main` n'est plus déployée par Vercel. `/qa` : 3 épreuves conformes (`docs/features/brain-37-deploiement-apres-migration/qa-report.md`).
- Secours : Instant Rollback d'abord, puis `vercel deploy` sans `--prod` depuis un clone neuf (`docs/gotchas.md`).
- Vérifié (PR #16) : `pnpm test` 3129 verts ; typecheck vert ; lint rouge à cause de `qa-screenshots/` (gitignoré).

## Prochaine étape
Feature `listes` (BRAIN-9, BRAIN-10) en cours sur `feat/listes` : spec validée le 2026-11-28 (`docs/features/listes/spec.md`), ADR-011 accepté (Ably en signal), plan écrit (`docs/features/listes/plan.md`, 49 tâches en trois PR : A Courses, B partage et temps réel, C Wishlist et Bucket List), **à relire par Antoine avant exécution**. Tâche 1 à attaquer : rayons (clés, ordre par défaut, libellés). Aucune PR ouverte ; B demande d'abord les gestes d'Antoine de la tâche 18 (compte Ably, `SHARE_TOKEN_KEY`). Reste BRAIN-37 (optionnel) : épreuve « deux merges rapprochés ».

## Règles et tests rouges
- Push libre sur la branche ; `main` et PR sur accord. Migrations : `pnpm db:migrate:test` et `pnpm db:migrate` seulement après fusion de la PR qui les porte.
- Rouge à revérifier : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`) ; `pnpm lint` (`qa-screenshots/`).

## Questions ouvertes
- Jetons Vercel CI : BRAIN-73 (échéance 2027-02-08) ; `VERCEL_PRODUCTION_TOKEN` expire le 2027-02-25, `VERCEL_TOKEN` le 2027-02-15.
- BRAIN-50 « à confirmer en production » : `rejects.toMatchObject` sur `errorTag`, `/qa` scénario 2, `--suspend`.
- BRAIN-67 (moyenne) : tableau réaffiché après expiration ou déconnexion ; cas de la déconnexion explicite à vérifier (`security-auditor`).
- `SEED_OWNER_USER_ID` : secret en place, variable GitHub à supprimer par Antoine. jose : JWKS distant non joué.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry BEMYBRAIN-1 ouverte ; MCP Vercel sans accès au pare-feu (404).
- Design `effets-de-verre` (non revérifié) : menus Date et Tags mobile, Notes, place vide à 1440 px, survol.
- Kanban (critique 29/40) : anneau de focus de la croix, « Bloquée » en tête, « Sous-tâches » ambigu, « BeMyBrain » tronqué en EN à 390 px, ~120 px vides à 1920 px.
- Tickets : BRAIN-64 (flèche après Espace, KO à 280 px), 65, 66 (faible), 51, 53, 55, 26, 35, 36, 37, 49 ; faible : 43, 44, 45.
- Migrations BRAIN-46 (0008, 0009) : appliquées sur `test` et `dev` après fusion ? Non vérifié.

**Reprise** : `/clear`, `/model sonnet`, puis : `Exécute docs/features/listes/plan.md avec subagent-driven-development, en dispatchant subagent_type implementer pour chaque tâche et subagent_type reviewer par bloc de tâches (une par une pour les tâches [security] et les migrations), puis security-auditor après le reviewer de chaque tâche [security]. Tests ciblés pendant les tâches, suite complète une seule fois avant la PR.` (commencer par la PR A, tâches 1 à 17.)
