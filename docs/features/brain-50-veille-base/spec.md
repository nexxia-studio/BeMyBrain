# Spec — BRAIN-50 : ouverture après mise en veille de la base

**Créée le** : 2026-11-23 · **Statut** : brouillon (solution à trancher par Antoine) · **Plan** : `plan.md` · **Branche** : `fix/brain-50-veille-base`

## Objectif
Antoine ouvre l'app après une longue inactivité : il voit son tableau de bord, jamais « Une erreur est survenue ».

## Reproduction (2026-11-23, branche Neon `test`)
Script : pool réel (`createPool`), 4 lectures parallèles en transaction, comme le tableau de bord.
1. Chauffe : 4 lectures OK, le pool garde ses connexions au repos.
2. Processus gelé par `SIGSTOP` : imite la pause de la fonction Vercel (minuteurs et sockets gelés).
3. Compute `test` mis en veille par l'API Neon (`suspend_postgres_endpoint`) : Neon coupe les connexions.
4. `SIGCONT` puis lectures immédiates.

Observé :
- Au réveil : **4 lectures sur 4 en échec en 3 ms**, `Connection terminated unexpectedly` (sans code SQLSTATE). Même signature que BEMYBRAIN-3 (4 occurrences en 10 s).
- Les fermetures de socket ne sont traitées qu'après : le pool a prêté les 4 connexions mortes avant de les savoir mortes.
- Ouverture suivante : 4 lectures OK (~840 ms, réveil du compute compris). D'où « ça remarche si on recharge ».
- Témoin, même gel sans mise en veille : 4 lectures OK au réveil.

Hypothèse du ticket confirmée : connexions tuées par la veille Neon pendant la pause Vercel, prêtées au réveil.
Le délai d'inactivité actuel du pool (30 s, défaut du pilote Neon) n'y change rien : il n'expire jamais avant la pause.

## Solutions comparées

| | A. `attachDatabasePool` (`@vercel/functions`) | B. Délai d'inactivité court | C. Une nouvelle tentative avant tout travail |
| --- | --- | --- | --- |
| Principe | Vercel garde la fonction éveillée le temps de fermer les connexions au repos avant la pause | Le pool ferme ses connexions au repos plus vite | Si la connexion meurt avant que la transaction ait commencé son travail, on la rejoue une fois sur une connexion neuve |
| Efficace ? | Oui sur Vercel, si Fluid compute actif (non vérifiable par le MCP, à confirmer) | **Non**, sauf à 0 : la pause survient quelques ms après la réponse, avant tout délai | Oui, quelle que soit la cause (veille, redémarrage, maintenance du samedi, réseau) |
| Dépendance | Nouvelle (`@vercel/functions`) | Aucune | Aucune |
| Couplage | Couche base liée à Vercel (même souci que BRAIN-28) | Aucun | Aucun |
| Testable en local | Non (le crochet n'existe que sur Vercel) | Oui, mais prouve l'inefficacité | Oui, avec la reproduction ci-dessus en test automatisé |
| Coût utilisateur | Aucun | À 0 : connexion neuve à chaque requête, ~+150 ms par lecture (240 ms contre 90 ms mesurés) | Au réveil : +3 ms (échec) ; le réveil du compute (~1 s) est payé par toutes les options |
| Coût de code | ~5 lignes dans `createPool` | 1 ligne | ~40 lignes dans `createWithUserDb` + tests |
| Écritures | Couvertes | Couvertes | Couvertes sans risque : on ne rejoue que si **rien** n'a été envoyé de la transaction métier (mort au `BEGIN` ou à la pose de l'identité). Une écriture n'est jamais exécutée deux fois |

**Avis : C.** Seule option qui garantit le critère de fin, testable ici, sans dépendance ni couplage Vercel.
A peut venir en complément plus tard (moins d'échecs à rattraper) ; elle ne garantit rien seule. B est écartée : inefficace, ou coûteuse à 0.

Variante de C par rapport au ticket : au lieu de « lectures seulement » (il faudrait séparer lectures et écritures dans toute l'app), on rejoue toute transaction **dont le travail n'a pas commencé**. Plus sûr et plus simple ; le ticket l'interdisait pour les écritures à cause du risque de double exécution, absent ici.

## Hors périmètre
- BRAIN-51 (durcissements du pool), BRAIN-37 (ordre migration / mise en ligne).
- Une connexion qui meurt **pendant** le travail d'une transaction : pas rejouée, l'erreur reste (cas QA-4, déjà sans plantage du processus).
- BRAIN-47 et BRAIN-54 : traités après, dans cette même session.

## Critères d'acceptation
- [ ] Connexions du pool tuées pendant un gel du processus : au réveil, 4 lectures parallèles via `withUserDb` réussissent (test automatisé, branche `test`).
- [ ] Une transaction dont la connexion meurt après le début de `fn` n'est pas rejouée : `fn` appelée une seule fois, erreur remontée.
- [ ] Une seule nouvelle tentative : deux échecs de connexion de suite → erreur remontée (écran d'erreur, pas de boucle).
- [ ] Erreurs qui ne sont pas une connexion perdue (jeton refusé, RLS, SQL) : jamais rejouées.
- [ ] Preview : compute de la branche de preview mis en veille, tableau de bord ouvert après plus de 5 min sans requête → tableau de bord affiché.

## Scénarios utilisateur (joués par /qa)
1. **Ouverture après veille** — Antoine, connecté sur la preview, n'ouvre rien pendant 10 min ; le compute de la branche est mis en veille ; il ouvre `/dashboard` → tableau de bord, pas d'écran d'erreur. Variante mobile : oui (iPhone, app installée).
2. **Action après veille** — même situation, onglet `/tasks` resté ouvert ; il coche une tâche → enregistrée une seule fois.

## Données et sécurité
- Tables touchées : aucune. Pas de migration.
- `src/db/user-db.ts` touché (identité posée dans la transaction) → `security-auditor` après le reviewer : la tentative rejouée doit reposer l'identité vérifiée, jamais réutiliser un état de la première.

## UI
- Aucune.

## Questions ouvertes
- [ ] Choix de la solution (A, B, C, ou C + A) — à trancher par Antoine avant la tâche 1.
- [ ] Fluid compute actif sur le projet Vercel `bemybrain` ? Seulement si A est retenue.
