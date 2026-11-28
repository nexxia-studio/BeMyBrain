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
| shopping | `src/modules/shopping` | liste de courses par rayon, correction mémorisée, ordre des rayons, partage par lien (PR B) | socle | PR A en cours (Courses) |
| wishlist | `src/modules/wishlist` | souhaits (lien, prix, priorité, catégorie) | socle, categories | PR C, à venir |
| bucket | `src/modules/bucket` | bucket list (catégorie, date, faits) | socle, categories | PR C, à venir |
| categories | `src/modules/categories` | table de catégories commune à la wishlist et à la bucket list (renommables, « Autre » fixe) | socle | PR C, à venir |
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
| `shopping_lists` | `workspace_id` | la liste de courses du workspace (une seule) | migration 0011 ; porte `rev`, incrémenté à chaque écriture |
| `shopping_items` | `workspace_id` | articles : libellé, rayon (`aisle_key`, CHECK), coché, auteur (`added_by_guest`) | migration 0011 ; plafonds en base (300 articles, 80 caractères) |
| `shopping_aisle_overrides` | `workspace_id` | correction d'un rayon mémorisée par libellé normalisé complet | migration 0011 |
| `shopping_aisle_order` | `workspace_id` | ordre des rayons choisi par l'utilisateur | migration 0011 ; ordre par défaut en code (`aisles.ts`) |

## Flux critiques
1. Connexion : écran login → auth → session serveur → `workspaceId` résolu → coque. Session expirée pendant une action → `/login?next=<chemin interne>` → retour sur la page.
2. Lecture d'un module : page serveur → `queries.ts` (filtre `workspace_id`) → rendu.
3. Accès base : seul `createPool` (`src/db/pool.ts`) crée un pool ; utilisé par `src/db/client.ts` (app) et `src/db/admin.ts` (`withAdminTx`, seed). Écouteur d'erreur posé sur chaque connexion. Toute transaction passe par `runTransaction` (`src/db/transaction-retry.ts`) : une nouvelle tentative unique si la connexion tombe avant le travail métier ; classement des erreurs de connexion par `src/db/connection-lost.ts`.
4. Chargement du tableau de bord et des listes : `loading.tsx` affiche le givre (CSS pur, `FrostTile`, `src/components/loading/`) aux tailles réelles de la grille ou de la liste, puis le contenu remplace le givre sans décalage.
5. Hauteurs des tuiles : après affichage, `TileHeightRecorder` (`src/components/bento/`) écrit le cookie `bmb-dashboard-tiles` (`Path=/dashboard`, 30 jours). `dashboard/loading.tsx` le lit ; `src/modules/dashboard/tile-heights.ts` valide la valeur (taille bornée, identifiants connus, 1 024 caractères au plus).
6. Reflet : une fois par session, à la fin de la révélation de la grille, un calque par tuile de verre balaie (GSAP, `transform` seul) ; rendu par `TileSurface`, animé par `bento-reveal.tsx`.

7. Courses : page serveur `/lists/shopping` → `queries.ts` du module `shopping` ; chaque écriture passe par une action du registre `shopping.*` (`src/modules/shopping/actions.ts`, ADR-009) → `mutations.ts`, qui range l'article (corrections mémorisées, puis dictionnaire de mots, sinon « Divers ») et incrémente `rev` de la liste. `rev` sert de signal de changement (temps réel de la PR B, ADR-011) ; la tuile Courses du tableau de bord lit `loadShoppingSummary`.

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
