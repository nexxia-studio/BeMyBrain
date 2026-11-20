# Architecture — BeMyBrain

<!-- Court et à jour vaut mieux que complet et faux. Mis à jour par scribe quand un module, une table ou un flux change. -->

## Vue d'ensemble
Application Next.js (App Router) hébergée sur Vercel. Données dans une seule base Neon (Postgres), accédée côté serveur avec Drizzle.
Un compte = un `workspace`. V1 : un seul workspace (Antoine). Aucun paiement en V1.
Isolation entre comptes par double verrou : RLS dans la base + filtre dans le code (ADR-002). Connexion : Managed Better Auth de Neon (ADR-003).
Chaque module métier vit dans `src/modules/<module>/` et expose ses lectures et écritures ; l'interface ne parle jamais à la base directement.

## Modules
| Module | Dossier | Rôle | Dépend de | État |
| --- | --- | --- | --- | --- |
| socle | `src/app`, `src/db`, `src/modules/core` | login, workspace, contextes Privé/Pro, coque bento | Neon, auth | clos 2026-11-18 |
| tasks | `src/modules/tasks` | to-do unifiée Privé / Trustup / Nexxia, tags | socle | tranche 1 livrée 2026-11-20 |
| lists | `src/modules/lists` | bucket lists, liste de courses partagée par lien | socle | à spécifier |
| finance | `src/modules/finance` | budget, transactions, investissements, assurances, mobilier | socle | plus tard |

Les autres modules sont listés dans `docs/roadmap.md` et n'entrent ici qu'au moment de leur spec.

## Tables principales
| Table | Tenant | Rôle | Notes |
| --- | --- | --- | --- |
| `workspaces` | — | un compte | |
| `workspace_members` | `workspace_id` | lien utilisateur ↔ workspace, rôle, langue | `role` et `locale` en `text` + CHECK (ADR-007) |
| `contexts` | `workspace_id` | Privé, Trustup, Nexxia… | `kind` : `private` ou `pro` ; `color` : `neutral`, `warm` ou `indigo` (CHECK) ; l'utilisateur crée les siens |
| `tasks` | `workspace_id` | tâches, sous-tâches (`parent_id`), côté, espace, corbeille (`deleted_at`) | pas de DELETE (RLS) ; `origin` non modifiable |
| `tags` | `workspace_id` | étiquettes de tâches | pas de DELETE (RLS) |
| `task_tags` | `workspace_id` | lien tâche ↔ tag | |

## Flux critiques
1. Connexion : écran login → auth → session serveur → `workspaceId` résolu → coque. Session expirée pendant une action → `/login?next=<chemin interne>` → retour sur la page.
2. Lecture d'un module : page serveur → `queries.ts` (filtre `workspace_id`) → rendu.

## Intégrations externes
| Service | Usage | Clé / config |
| --- | --- | --- |
| Neon | base de données | `DATABASE_URL` dans `.env` (jamais ici) |
| Vercel | hébergement, previews, cron | projet Vercel |
| Sentry | erreurs de production et de preview, alerte e-mail (projet région UE) | `SENTRY_DSN` dans Vercel (jamais ici) |
| Linear | suivi (équipe BeMyBrain, préfixe BRAIN) | — |

Les intégrations de données (banque, Strava, Apple Santé, Home Assistant…) sont décrites dans `docs/roadmap.md`.

## Environnements
- Région : Neon et Vercel à Francfort (ADR-005). Projet Neon `bemybrain` créé au socle.
- Local : `pnpm dev` + branche Neon de développement.
- Preview : une URL Vercel et une branche Neon par pull request. Tests et `/qa` se font ici.
- Production : branche git `main`, branche Neon `production`.
- Staging : pas créé ; prêt à brancher au moment du multi-comptes (ADR-005).
