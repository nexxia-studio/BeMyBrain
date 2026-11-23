# Plan — BRAIN-50 : ouverture après mise en veille de la base

**Spec** : `spec.md` · **Branche** : `fix/brain-50-veille-base` · **Créé le** : 2026-11-23

Plan écrit pour la solution C (avis). En attente du choix d'Antoine : si A ou C + A, la tâche 4 est ajoutée.
Aucune nouvelle dépendance pour C.

## Tâches
- [ ] **1. Reproduction en test automatisé (rouge)**
  - Fichiers : `tests/db/pool-dead-after-freeze.test.ts`, `tests/factories/frozen-pool-child.mts` (processus enfant)
  - Test à écrire d'abord : « connexions tuées pendant le gel → 4 lectures `withUserDb` réussissent au réveil ». L'enfant chauffe un pool `createPool` de 4 connexions et se met en attente ; le test le gèle (`SIGSTOP`), tue ses connexions par `pg_terminate_backend` (rôle `app_backend`, même procédé que `pool-connection-loss.test.ts`), le réveille (`SIGCONT`) et lit le résultat. Témoin : sans coupure, 4 lectures OK.
  - Fini quand : le test échoue sur `main` avec `Connection terminated unexpectedly` ×4, le témoin passe.
- [ ] **2. Une nouvelle tentative si la connexion meurt avant le travail** [security]
  - Fichiers : `src/db/user-db.ts`, `src/db/connection-lost.ts`
  - Tests à écrire d'abord (`src/db/user-db.test.ts`, `src/db/connection-lost.test.ts`) :
    - « connexion perdue au BEGIN ou à la pose de l'identité → rejouée une fois, identité reposée »
    - « connexion perdue après le début de `fn` → `fn` appelée une fois, erreur remontée »
    - « deux pertes de suite → erreur remontée »
    - « jeton refusé, RLS, erreur SQL → jamais rejoués »
    - classement : `Connection terminated unexpectedly`, fin de socket, SQLSTATE `57P01`/`57P02`/`57P03`/`08xxx` → perte ; le reste → non.
  - Fini quand : tests unitaires verts et le test de la tâche 1 vert.
- [ ] **3. Vérification sur preview**
  - Pousser la branche, attendre la preview, mettre en veille le compute de sa branche Neon, ouvrir `/dashboard` après 5 min sans requête.
  - Fini quand : tableau de bord affiché, aucune nouvelle occurrence de BEMYBRAIN-3 dans Sentry (environnement preview).

## Corrections QA

## Terminé
