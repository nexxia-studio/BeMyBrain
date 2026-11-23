# Spec — BRAIN-50 : ouverture après mise en veille de la base (+ BRAIN-47, BRAIN-54)

**Créée le** : 2026-11-23 · **Statut** : validée (solution C, choix d'Antoine du 2026-11-23) · **Plan** : `plan.md` · **Branche** : `fix/brain-50-veille-base`

## Objectif
Antoine ouvre l'app après une longue inactivité : il voit son tableau de bord, jamais « Une erreur est survenue ».

## Reproduction (2026-11-23, branche Neon `test`)
Script : pool réel (`createPool`), 4 lectures parallèles en transaction, comme le tableau de bord.
1. Chauffe : 4 lectures OK, le pool garde ses connexions au repos.
2. Processus gelé par `SIGSTOP` : imite la pause de la fonction Vercel (minuteurs et sockets gelés).
3. Compute `test` mis en veille par l'API Neon : Neon coupe les connexions.
4. `SIGCONT` puis lectures immédiates.

Observé :
- Au réveil : **4 lectures sur 4 en échec en 3 ms**, `Connection terminated unexpectedly` (sans SQLSTATE). Même signature que BEMYBRAIN-3.
- Les fermetures de socket ne sont traitées qu'après : le pool a prêté les 4 connexions mortes avant de les savoir mortes.
- Ouverture suivante : 4 lectures OK (~840 ms, réveil du compute compris).
- Témoin, même gel sans mise en veille : 4 lectures OK.

Cause confirmée : connexions tuées par la veille Neon pendant la pause Vercel, prêtées au réveil. Le délai d'inactivité du pool (30 s) n'expire jamais avant la pause.
Procédure rejouable : `docs/runbooks/veille-base.md`.

## Solution retenue : C, une nouvelle tentative avant le travail
Écartées : A (`attachDatabasePool`, nouvelle dépendance, liée à Vercel, non testable en local, ne garantit rien seule), B (délai d'inactivité court, inefficace sauf à 0, qui supprime le pool : ~+150 ms par lecture). Comparaison détaillée dans l'historique git de ce fichier (`c17e680`).

### Règles (non négociables)
1. **Frontière stricte.** Une transaction n'est rejouée que si l'échec survient **avant** que sa fonction métier ait commencé : prise de connexion, `BEGIN`, mise en place de l'identité (`withUserDb`). Dès que la fonction métier a démarré, aucune nouvelle tentative, même pour une lecture.
2. **Une seule nouvelle tentative, sur une erreur de connexion uniquement.** Erreur de connexion = connexion fermée ou coupée côté client (`Connection terminated unexpectedly`, socket fermé, connexion inutilisable) ou SQLSTATE de classe `08` et `57P01`/`57P02`/`57P03`. Jamais sur une erreur SQL, un refus RLS, un jeton refusé, une erreur d'identité ou une erreur métier.
3. **La connexion morte est retirée du pool avant la nouvelle tentative**, ainsi que les autres connexions au repos du même pool (gelées en même temps, elles sont suspectes) : la nouvelle tentative part sur une connexion neuve.
4. **Trace.** Chaque nouvelle tentative écrit une ligne de journal (`console.warn`) : nom du pool (rôle) et étape où la connexion est tombée, sans donnée personnelle (ni identifiant, ni requête, ni message du pilote). Pas d'envoi Sentry quand la seconde tentative réussit ; si elle échoue, l'erreur suit le chemin habituel (`DatabaseError`, écran d'erreur, Sentry).
5. **Tous les points d'accès à la base passent par le même mécanisme** (liste ci-dessous).

### Points d'accès à la base (inventaire du 2026-11-23)
| Point d'entrée | Pool | Utilisé par | Couvert par |
| --- | --- | --- | --- |
| `withUserDb` (`src/db/client.ts` → `createWithUserDb`, `src/db/user-db.ts`) | `createPool`, rôle `app_backend` | toute l'app : `src/modules/*/{queries,load,mutations,contexts,locale,membership}.ts`, registre d'actions (`src/modules/actions/run.ts`) | tâche 3 |
| `adminDb` (`src/db/admin.ts`) | `createPool`, rôle propriétaire | `scripts/seed.ts` (`seedWorkspace`, une transaction) | tâche 4 : `withAdminTx`, `adminDb` n'est plus exporté nu |
| `drizzle-kit migrate` (`drizzle.config.ts`, CI `migrate-production.yml`) | pilote propre à drizzle-kit | migrations | hors périmètre : processus court, jamais gelé, rejouable en entier |
| Fabriques de test (`tests/factories/core.ts`, `as-user.ts`) | `new Pool` | tests seulement | hors périmètre |

Verrou (`tests/db/pool-inventory.test.ts`, tâche 4) : aucun pool, client ni pilote de base (`new Pool`, `new Client`, `neon(`, `drizzle(`, imports de `@neondatabase/serverless`, `pg`, `postgres`, `drizzle-orm/<pilote>`) hors de `src/db/pool.ts`, `src/db/client.ts`, `src/db/admin.ts`, `src/db/transaction-retry.ts` (`createPooledDb`), de `tests/` et des fichiers `*.test.*`. `adminDb` n'est plus exporté : `withAdminTx` et `endAdminPool` seulement.

## BRAIN-47 et BRAIN-54 : erreur et chargement du détail d'une tâche
Cause commune : en Next 16, `error.tsx` et `loading.tsx` de `tasks/` enveloppent aussi l'emplacement `@detail`.
- **BRAIN-47.** Une lecture du détail en échec s'affiche dans le détail (panneau sur ordinateur, tiroir sur mobile), avec un message propre au détail, « Réessayer » (`retry`) et « Fermer », envoyée à Sentry comme aujourd'hui. Ni `<main>` ni `<h1>` en plus dans la page.
- **BRAIN-54.** Pendant le chargement de `/tasks`, un seul titre « To-do » et un seul givre de liste. Le chargement du détail a son propre givre (fiche de détail), ou rien.

## Hors périmètre
- BRAIN-51 (durcissements du pool), BRAIN-37 (ordre migration / mise en ligne), `attachDatabasePool`.
- Une connexion qui meurt **pendant** la fonction métier : pas rejouée, l'erreur reste (cas QA-4, sans plantage du processus).

## Critères d'acceptation
- [ ] Connexions du pool tuées pendant un gel du processus : au réveil, 4 lectures parallèles via `withUserDb` réussissent. Test automatisé sur la branche `test`, coupure par `pg_terminate_backend`, sans API Neon.
- [ ] Une **écriture** dont la connexion tombe pendant la fonction métier n'est jamais rejouée : fonction appelée une fois, aucune ligne en double, erreur remontée (test sur la vraie base).
- [ ] Échec au `BEGIN` ou pendant la pose de l'identité : rejouée une fois, identité reposée sur la nouvelle connexion.
- [ ] Deux erreurs de connexion de suite : erreur remontée, pas de troisième essai.
- [ ] Erreur SQL, refus RLS, jeton refusé, `IdentityNotAppliedError`, `DomainError`, erreur de contrôle Next : jamais rejoués.
- [ ] La connexion morte et les connexions au repos du pool sont retirées avant la nouvelle tentative.
- [ ] Une ligne de journal par tentative rejouée, sans donnée personnelle ; aucun appel à Sentry dans ce chemin.
- [ ] `seedWorkspace` passe par le même mécanisme ; inventaire des pools verrouillé.
- [ ] Runbook `docs/runbooks/veille-base.md` + script de reproduction, refus de viser la production.
- [ ] Preview : compute de la branche Neon de la preview mis en veille, `/dashboard` ouvert → tableau de bord affiché.
- [ ] BRAIN-47 : erreur du détail affichée dans le détail, « Réessayer » et « Fermer », un seul `<main>` et un seul `<h1>` dans la page.
- [ ] BRAIN-54 : pendant le chargement de `/tasks`, un seul titre « To-do » et un seul givre de liste (e2e).

## Scénarios utilisateur (joués par /qa)
1. **Ouverture après veille** — Antoine, connecté sur la preview ; le compute de la branche de preview est mis en veille ; il ouvre `/dashboard` → tableau de bord, pas d'écran d'erreur. Variante mobile : oui.
2. **Action après veille** — onglet `/tasks` ouvert, compute mis en veille, il coche une tâche → enregistrée une seule fois.
3. **Erreur du détail** — lecture du détail forcée en échec → message dans le panneau (ordinateur) ou le tiroir (mobile), « Fermer » ramène à la liste, « Réessayer » relance. Variante mobile : oui.
4. **Chargement de la liste** — `/tasks` ouvert avec lecture ralentie → un seul titre, un seul givre de liste. Variante mobile : oui.

## Données et sécurité
- Tables touchées : aucune. Pas de migration.
- `src/db/user-db.ts`, `src/db/pool.ts`, `src/db/admin.ts` touchés → `security-auditor` après le reviewer (tâches 2, 3, 4) : la tentative rejouée repose l'identité vérifiée, ne réutilise aucun état de la première, et la trace ne porte aucune donnée.

## UI
- BRAIN-47 et BRAIN-54 seulement : `src/app/(app)/tasks/@detail/` et le groupe `src/app/(app)/tasks/(list)/` (liste et son chargement, BRAIN-54). Réutiliser `FrostTile`, la tuile d'erreur de `tasks/error.tsx` et les textes `next-intl` (FR/EN, ADR-007). Rien hors DESIGN.md.

## Questions ouvertes
- Aucune.
