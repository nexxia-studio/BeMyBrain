## QA — brain-50-veille-base — 2026-11-23

Joué en local : build de production de la branche (`f09c2a5`) servi par `next start`, base `dev`, compte e2e. Ordinateur 1440 × 900 (Chromium), mobile iPhone 15 en Chromium (390 px). Captures et scripts : `qa-screenshots/brain-50/` (ignoré par git). Le commit suivant (`dbcb994`) ne touche que des docs.

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Ouverture après veille — fumée locale seulement (`/dashboard` s'affiche) | PASS (fumée) | `s1-desktop-dashboard.png`, `s1-mobile-dashboard.png` ; un seul `h1` « Tableau de bord », un seul `main`, aucune erreur console, aucune requête 4xx/5xx |
| 2 | Action après veille — fumée locale seulement (cocher une tâche) | PASS (fumée) | `s2-*-terminee.png` ; 1 seul POST de Server Action par clic, tâche terminée après rechargement (une seule ligne, dans « Terminées »), rouverte puis mise à la corbeille |
| 3 | Erreur du détail (BRAIN-47), ordinateur et mobile | PASS | `s3-desktop-depuis-liste.png`, `s3-desktop-direct.png`, `s3-mobile-depuis-liste.png`, `s3-mobile-direct.png`, `s3-*-reessayer-ok.png` |
| 4 | Chargement de la liste (BRAIN-54), ordinateur et mobile | PASS | `s4-*-givre-liste.png`, `s4-*-attente-detail.png` ; maximums relevés : 1 `h1`, 1 `main`, 1 givre de liste ; ouverture du détail : 0 givre, pas de titre en plus |

**Scénarios 1 et 2 « après veille »** : joués en local en fumée, sans veille. Scénario 1 joué ensuite sur la preview (ci-dessous).

### Scénario 1 sur la preview (2026-11-23, coordinateur)
- Compute de la branche Neon de la preview mis en veille par l'API Neon (vérifié : branche de preview, pas `production`).
- Essai 1 : `/dashboard` rouvert 30 s après la mise en veille → tableau de bord affiché (le cas du bug ne s'est pas produit, voir plus bas).
- Essai 2 : `/dashboard` ouvert, 6 min d'inactivité, mise en veille, `/dashboard` rouvert aussitôt → tableau de bord affiché (idem).
- Sentry : aucune nouvelle erreur. Journaux Vercel : aucune erreur, mais aussi aucune ligne « Nouvelle tentative ».
- **Le cas du bug ne s'est pas produit sur la preview** : le critère de fin de BRAIN-50 n'est donc prouvé qu'en local. BRAIN-50 reste ouvert « à confirmer en production » : on le ferme quand une ligne « Nouvelle tentative » apparaît dans les journaux de production, suivie d'un affichage normal.
- Détail : la nouvelle tentative n'a pas été déclenchée sur la preview. Au premier essai, la fonction était encore éveillée et a vu les connexions se fermer. Au second, Vercel a sans doute démarré une instance neuve, sans connexion au repos. Le cas « connexions mortes prêtées au réveil » est prouvé en local (`tests/db/pool-dead-after-freeze.test.ts`, script du runbook : 4/4 OK, 4 nouvelles tentatives). En production, la ligne « Nouvelle tentative » dans les journaux Vercel dira à quelle fréquence il survient.
- Scénario 2 (cocher après veille) : non joué sur la preview, aucune tâche sur son compte. Couvert par `tests/db/write-not-replayed.test.ts` et `src/db/transaction-retry.test.ts`.

### Détail du scénario 3
- Erreur forcée dans un worktree jetable (supprimé), jamais committé. Variante du `throw` prévu par le plan (tâche 6) : `throw new Error("qa")` juste après `requireSessionWithToken()`, conditionné à la présence d'un fichier témoin. Cela permet de retirer l'erreur sans rebuild.
- Ouverture depuis la liste : « Détail indisponible » et son texte dans le panneau (ordinateur) ou le tiroir (mobile). Message d'erreur de la liste absent. Un seul `h1` (« To-do ») et un seul `main`, au maximum pendant toute la séquence.
- « Réessayer » avec l'erreur toujours active : l'erreur se réaffiche (attendu). « Fermer » ramène à `/tasks`, le détail est fermé et la liste affichée.
- Rechargement direct de `/tasks/<id>` : mêmes vérifications, PASS.
- Erreur retirée sans rebuild, puis « Réessayer » : le détail de la tâche s'affiche (titre de la tâche dans le champ). Un `h1`, un `main`.
- Console : `Minified React error #441` à chaque erreur rendue côté client (3 par appareil). C'est la trace de l'erreur forcée, attendue. Aucune requête 4xx/5xx. Côté serveur : `Error: qa` seulement.

### Détail du scénario 4
- Ralentissement de 2,5 s sur la requête RSC de navigation (procédé de `e2e/todo-chargement.spec.ts`), relevé des maximums dans le DOM par `MutationObserver`.
- Navigation `/dashboard` → `/tasks` : `{h1: 1, main: 1, tasksFrost: 1}` et un seul givre au total, desktop et mobile.
- Ouverture d'un détail depuis la liste : `{h1: 1, main: 1, tasksFrost: 0}`, aucun givre.
- Chargement direct de `/tasks` et de `/tasks/<id>` : 1 `h1`, 1 `main`, 1 givre de liste visibles au maximum.
- `e2e/todo-chargement.spec.ts` rejoué contre ce build (`--project=desktop --project=mobile`) : 4/4 PASS.

### Annexes (ordinateur)
- Retour arrière depuis un détail ouvert : retour à `/tasks`, détail fermé. PASS.
- Session expirée (cookies effacés) puis case cochée : renvoi vers `/login`. PASS.

### Échecs détaillés
- Aucun.

### Hors spec mais observé
- Les comptages bruts du DOM au chargement direct donnent 2 `h1` et 2 `main`, avec ou sans erreur. Le second exemplaire est dans le conteneur `hidden` du flux Next, avant sa substitution : jamais visible ni exposé à l'accessibilité. Pas un défaut, mais un test qui compte `document.querySelectorAll("h1")` sans exclure `[hidden]` peut échouer à tort.
- Ouverture d'un détail avec lecture lente : rien ne bouge pendant l'attente (2,5 s ici), ni givre ni indicateur. C'est conforme à BRAIN-54 (« la liste reste affichée »), mais le clic n'a aucun retour visible pendant l'attente. Question produit : faut-il un retour discret (état pressé de la ligne, par exemple) ?
- Capture `s3-desktop-depuis-liste.png` prise pendant l'animation d'entrée du panneau : il est encore translucide sur son bord gauche. Une fois l'animation finie, il est opaque (`s3-desktop-direct.png`).
- Mobile joué en Chromium avec l'émulation iPhone 15, pas en WebKit (cookies `__Secure-` refusés sur http://localhost). À confirmer sur un vrai iPhone ou en WebKit contre la preview.
