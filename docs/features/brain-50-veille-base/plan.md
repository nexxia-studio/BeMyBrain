# Plan — BRAIN-50 : ouverture après mise en veille de la base (+ BRAIN-47, BRAIN-54)

**Spec** : `spec.md` · **Branche** : `fix/brain-50-veille-base` · **Créé le** : 2026-11-23

Solution C (choix d'Antoine, 2026-11-23). Aucune nouvelle dépendance.
Tests base : branche Neon `test` (`DATABASE_TEST_URL`, `DATABASE_TEST_AUTHENTICATED_URL`), procédés de `tests/db/pool-connection-loss.test.ts`.

## Tâches
- [x] **1. Reproduction en test automatisé (rouge)**
  - Fichiers : `tests/db/pool-dead-after-freeze.test.ts`, `tests/factories/frozen-pool-child.mts`
  - Test à écrire d'abord : « connexions tuées pendant le gel → 4 lectures parallèles réussissent au réveil ». L'enfant (vrai `createPool` + `createWithUserDb`, vérificateur de jeton remplacé comme dans `pool-connection-loss.test.ts`) chauffe 4 connexions et annonce leurs `pg_backend_pid` ; le test le gèle (`SIGSTOP`), tue ces backends (`pg_terminate_backend`, connexion `app_backend` séparée), attend que les sockets soient fermés côté serveur, puis le réveille (`SIGCONT`) en déclenchant aussitôt les lectures. Témoin : même gel sans coupure → 4 lectures OK. Arrêt de l'enfant garanti en fin de test (`SIGKILL` si besoin).
  - Fini quand : le test échoue sur l'état actuel avec 4 « Connection terminated unexpectedly », le témoin passe. Commit du test marqué `it.fails` ou équivalent documenté, rendu vert à la tâche 3.
- [x] **2. Classement des erreurs de connexion et purge du pool** [security]
  - Fichiers : `src/db/connection-lost.ts`, `src/db/pool.ts`
  - Tests à écrire d'abord : `src/db/connection-lost.test.ts` (« erreur de connexion » : message `Connection terminated unexpectedly`, `Connection terminated`, client non requêtable, SQLSTATE `08xxx`, `57P01`/`57P02`/`57P03`, sur l'erreur ou sa `cause` ; « pas une erreur de connexion » : SQLSTATE `42501` RLS, `23505`, `42P01`, `InvalidTokenError`, `IdentityNotAppliedError`, `DomainError`, erreur quelconque) ; `tests/db/pool-evict.test.ts` (vrai pool : `evictIdle` ferme toutes les connexions au repos, n'affecte pas une connexion empruntée, `totalCount` baisse).
  - `createPool` expose une purge des connexions au repos par l'API publique de pg-pool (événements `connect`/`acquire`/`release`/`remove`), sans toucher aux internes `_idle`.
  - Fini quand : tests verts, lint et typecheck verts.
- [ ] **3. Nouvelle tentative unique dans `withUserDb`** [security]
  - Fichiers : `src/db/transaction-retry.ts`, `src/db/user-db.ts`, `src/db/client.ts`
  - `runTransaction({ db, evictIdle, poolName }, setup, fn)` : transaction Drizzle ; `setup(tx)` puis drapeau « travail commencé » posé juste avant `fn` ; si erreur de connexion ET travail pas commencé ET premier essai → `console.warn` (pool + étape, rien d'autre), `evictIdle()`, un seul nouvel essai complet (nouvelle transaction, `setup` rejoué). Sinon erreur relancée telle quelle. Drizzle libère la connexion en erreur : vérifier qu'elle sort du pool (sinon la retirer explicitement).
  - Tests à écrire d'abord : `src/db/transaction-retry.test.ts` (faux db : perte au BEGIN → rejouée une fois ; perte dans `setup` → rejouée, `setup` rappelé ; perte dans `fn` → `fn` appelée une fois, erreur remontée ; deux pertes → erreur ; erreurs non-connexion → pas rejouées ; une ligne `console.warn` sans donnée ; aucun appel Sentry) ; `src/db/user-db.test.ts` complété (identité reposée au second essai, `unstable_rethrow` et `DomainError` inchangés) ; `tests/db/write-not-replayed.test.ts` (vraie base : une écriture `insert` dans `fn`, backend tué par `pg_terminate_backend` pendant `fn` (après l'insert, sur un `pg_sleep`) → `fn` appelée une fois, aucune ligne en double, `DatabaseError`).
  - Fini quand : tâche 1 verte, tous les tests `tests/db` et `src/db` verts.
- [ ] **4. `adminDb` sur le même mécanisme et inventaire des pools** [security]
  - Fichiers : `src/db/admin.ts`, `scripts/seed.ts`, `scripts/seed.test.ts`, `tests/db/pool-inventory.test.ts`
  - `admin.ts` exporte `withAdminTx(fn)` (via `runTransaction`, pool « propriétaire ») et `endAdminPool()` ; plus d'export de `adminDb` nu. `seedWorkspace` reçoit une fonction de transaction au lieu d'un `db`.
  - Tests à écrire d'abord : seed inchangé (rejouable, contextes) ; inventaire : aucun `new Pool(` ni `drizzle(` hors `src/db/{pool,client,admin}.ts` et `tests/`.
  - Fini quand : tests verts, `pnpm db:seed` (ou commande existante) fonctionne sur `dev`.
- [ ] **5. Runbook et script de reproduction**
  - Fichiers : `docs/runbooks/veille-base.md`, `scripts/repro/veille-base.mts`, `docs/README.md` (ligne d'index)
  - Le script : enfant avec le vrai pool, chauffe, `SIGSTOP`, coupure au choix (`--terminate` : `pg_terminate_backend` ; `--suspend` : API Neon `POST /projects/{id}/endpoints/{ep}/suspend` avec `NEON_API_KEY` de l'environnement), `SIGCONT`, lectures, verdict. Refuse l'hôte de production (`assertNotProductionTarget` / `NEON_PRODUCTION_HOST`). N'affiche ni URL ni hôte.
  - Test à écrire d'abord : `scripts/repro/veille-base.test.ts` (refus de la production, arguments).
  - Fini quand : script joué sur `test` en `--terminate` : 4 OK après correctif ; runbook écrit (procédure manuelle preview incluse).
- [ ] **6. BRAIN-47 : erreur du détail dans le détail**
  - Fichiers : `src/app/(app)/tasks/@detail/(.)[id]/error.tsx`, `src/app/(app)/tasks/@detail/[id]/error.tsx` (composant partagé `src/components/tasks/TaskDetailError.tsx`), `messages/{fr,en}.json`
  - Tests à écrire d'abord : `TaskDetailError.test.tsx` (message du détail, « Réessayer » appelle `retry`, « Fermer » ramène à `/tasks`, `reportClientError` appelé, ni `<main>` ni `<h1>`).
  - Fini quand : tests verts ; e2e : lecture du détail en échec → message dans le panneau / tiroir, une seule `main`.
- [ ] **7. BRAIN-54 : chargement du détail séparé de la liste**
  - Fichiers : `src/app/(app)/tasks/@detail/(.)[id]/loading.tsx`, `src/app/(app)/tasks/@detail/[id]/loading.tsx` (ou au niveau `@detail`), givre de la fiche de détail par `FrostTile`
  - Tests à écrire d'abord : test unitaire du chargement du détail ; e2e : pendant le chargement de `/tasks`, un seul titre « To-do » et un seul `data-testid="tasks-frost"`.
  - Fini quand : tests verts, desktop et mobile.
- [ ] **8. Vérification sur preview** (session principale)
  - Pousser la branche, attendre la preview, mettre en veille le compute de sa branche Neon, ouvrir `/dashboard`.
  - Fini quand : tableau de bord affiché, ligne de journal « nouvelle tentative » visible dans les journaux Vercel, aucune nouvelle occurrence de BEMYBRAIN-3.

## Corrections QA

## Terminé
