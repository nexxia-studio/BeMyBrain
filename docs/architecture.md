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
| socle | `src/app`, `src/db`, `src/modules/core` | login, workspace, contextes Privé/Pro, coque bento | Neon, auth | spec écrite |
| tasks | `src/modules/tasks` | to-do unifiée Privé / Trustup / Nexxia, tags | socle | à spécifier |
| lists | `src/modules/lists` | bucket lists, liste de courses partagée par lien | socle | à spécifier |
| finance | `src/modules/finance` | budget, transactions, investissements, assurances, mobilier | socle | plus tard |

Les autres modules sont listés dans `docs/roadmap.md` et n'entrent ici qu'au moment de leur spec.

## Tables principales
| Table | Tenant | Rôle | Notes |
| --- | --- | --- | --- |
| `workspaces` | — | un compte | |
| `workspace_members` | `workspace_id` | lien utilisateur ↔ workspace, rôle, langue | `role` et `locale` en `text` + CHECK (ADR-007) |
| `contexts` | `workspace_id` | Privé, Trustup, Nexxia… | `kind` : `private` ou `pro` ; l'utilisateur crée les siens |

## Flux critiques
1. Connexion : écran login → auth → session serveur → `workspaceId` résolu → coque.
2. Lecture d'un module : page serveur → `queries.ts` (filtre `workspace_id`) → rendu.

## Intégrations externes
| Service | Usage | Clé / config |
| --- | --- | --- |
| Neon | base de données | `DATABASE_URL` dans `.env` (jamais ici) |
| Vercel | hébergement, previews, cron | projet Vercel |
| Linear | suivi (équipe BeMyBrain, préfixe BRAIN) | — |

Les intégrations de données (banque, Strava, Apple Santé, Home Assistant…) sont décrites dans `docs/roadmap.md`.

## Environnements
- Région : Neon et Vercel à Francfort (ADR-005). Projets déjà existants.
- Local : `pnpm dev` + branche Neon de développement.
- Preview : une URL Vercel et une branche Neon par pull request. Tests et `/qa` se font ici.
- Production : branche `main`, à créer au `/feature socle`.
- Staging : pas créé ; prêt à brancher au moment du multi-comptes (ADR-005).
