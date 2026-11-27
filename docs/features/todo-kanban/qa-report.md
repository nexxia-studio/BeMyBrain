## QA — todo-kanban — 2026-11-27

Cible : branche `feat/todo-kanban`, HEAD `fb50d5f`, rejoué sur `a636cbc`, build de production (`pnpm build` puis `next start -p 3100`), compte e2e, base de développement. Serveur arrêté par son PID en fin de passe.

Méthode : `playwright-cli` n'est pas installé sur la machine. Les scénarios sont joués avec Playwright (Chromium ; iPhone 15 en émulation sur Chromium) de deux façons : (1) les parcours e2e du dépôt qui correspondent aux scénarios (68 tests, `desktop` + `mobile`, 1 worker, puis `langue`), (2) des scripts hors dépôt (`/tmp/qa-scripts/`) pour la géométrie, le clavier, le renommage au tap sur mobile et le tableau en anglais. Captures dans `docs/features/todo-kanban/qa/final/`. Console et requêtes 4xx/5xx relevées sur les trois largeurs : aucune.

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Faire avancer une tâche (desktop + mobile) | PASS | e2e scénario 1, desktop et mobile |
| 2 | Ranger une colonne, filtre d'espace (desktop + mobile) | PASS | e2e scénario 2 et variante Pro, desktop et mobile |
| 3 | Terminer et annuler (desktop + mobile) | PASS | e2e scénario 3 `@desktop` et `@mobile` |
| 4 | Échec d'enregistrement (desktop) | PASS | e2e scénario 4, deux variantes (réseau coupé puis Réessayer, dépôt refait) |
| 5 | Clavier (desktop) | PASS (rejeu a636cbc) | e2e scénario 5 vert ; script 1280 et 1920 px ; `qa/final/clavier-1280-apres-fix.png`, `clavier-1920-apres-fix.png` |
| 6 | Renommer d'un tap (desktop + mobile) | PASS | desktop : e2e « titre modifié d'un clic » ; mobile 390 px : script (tap carte, tap titre, Entrée, titre changé) `mobile-detail.png`, `mobile-renomme.png` |
| 7 | Sous-tâches sur le tableau (desktop + mobile) | PASS | e2e scénario 7, desktop et mobile |
| 8 | Transformer en sous-tâche (desktop + mobile) | PASS | e2e `todo-parente` scénario 8, desktop et mobile |
| 9 | Bloquer (desktop + mobile) | PASS | e2e `todo-relations` scénario 9, desktop et mobile |
| 10 | Corbeille (desktop) | PASS | e2e scénario 10 + `todo-sous-taches-corbeille` |
| 11 | Langue | PASS | e2e `todo-langue` (liste, détail, corbeille) + script : tableau en anglais à 1280 px (colonnes « TO PLAN / TO DO », interrupteurs « Subtasks / Hide completed subtasks », « Overdue », aria-label « Canceled, no cards, expand »), aucun texte français d'interface ; langue du compte remise en français ; `anglais-tableau-1280.png` |
| N | Nouveauté : tableau sans plafond, colonnes de 320 px (remises par a636cbc), fondu à droite | PASS | voir ci-dessous |

### Nouveauté du 2026-11-27 (mesures sur le build)
- 1280 px : rangée visible 959 px (de 291 à 1249), colonnes de 280 px (À planifier, À faire, En cours entières ; Terminée entamée sur 58 px ; Annulée repliée 109 px hors champ). Contenu 1309 px > 959 px : `data-more-end` posé, masque de fondu appliqué (`mask-image` linéaire). Défilé à droite : fondu à droite retiré, fondu à gauche posé. Pas de défilement horizontal de la page. `tableau-1280.png`, `tableau-1280-defile.png`.
- 1920 px : rangée 1588 px, contenu 1588 px, aucun fondu, aucun masque, les 5 colonnes tiennent (280 px chacune, Annulée 109 px). `tableau-1920.png`.
- 390 px : pas de colonnes côte à côte, barre d'onglets (À planifier, À faire, En cours, Terminée, Annulée) avec fondu à droite de la barre, aucun débordement horizontal de la page. `tableau-390.png`, `mobile-tableau.png`.
- e2e `todo-kanban-largeur` (1280 et 1920) : vert.
- Écart de formulation : à 1280 px on voit 3 colonnes entières et 0,2 de la quatrième (pas « 3,4 sur 5 ») ; le fondu est bien présent.

### Échecs détaillés
- **QA-1 (scénario 5, Clavier) : corrigé par a636cbc** (colonnes remises à 320 px, `md:w-80`). Cause confirmée : la largeur de 280 px de `fb50d5f`. Rejeu du 2026-11-27 sur le build de a636cbc :
  - e2e `scénario 5` (`--project=desktop`, 1 worker) : vert.
  - Script hors dépôt, 1280×720 et 1920×1000 : Espace puis une seule flèche droite depuis « À faire » annonce « Carte au-dessus de « En cours », position 1 sur 1. » ; Espace dépose, après rechargement la carte est dans « En cours » (0 dans « À faire »). Carte remise ensuite dans « À faire » au clavier. Console vide, aucune requête 4xx/5xx.
- Aucun autre échec.

### Rejeu de la géométrie (a636cbc)
- 1280 px : rangée 959 px, colonnes de 320 px (Annulée repliée 109 px), contenu 1469 px > 959 : `data-more-end` posé, masque de fondu appliqué ; après défilement à droite, fondu droit retiré, fondu gauche posé. Pas de débordement horizontal de la page.
- 1920 px : rangée 1588 px, colonnes de 320 px, les 5 tiennent, ni fondu ni masque.
- 390 px : une colonne à la fois (onglets), pas de débordement.
- Console et requêtes 4xx/5xx : aucune aux trois largeurs. Les mesures « 280 px » de la section précédente datent de `fb50d5f`.

### Bilan : 11/11 scénarios PASS (plus la nouveauté), aucun échec restant.

### Hors spec mais observé
- À 1920 px, le tableau (5 colonnes) occupe ~1310 px sur 1590 disponibles : ~280 px vides à droite de la colonne Annulée. Conséquence attendue du plafond levé et des colonnes fixes à 280 px ; à valider côté design.
- Le compte e2e garde 7 cartes dans « À faire » qui ne viennent pas de cette passe (« Livrer le site mwyvqmazc1qw », « Appeler le plombier… », « Préparer le déménagement mwo8… »…), restes d'anciens parcours ; non touchées.
- Scénario 6 mobile : aucun e2e du dépôt ne le joue (le parcours « titre modifié d'un clic » est `@desktop`). À ajouter si on veut le verrouiller.
- Scénario 11 : le parcours e2e `todo-langue` ne couvre pas le tableau ; vérifié ici à la main à 1280 px seulement (pas en anglais à 390 px).
- Non joués : état vide du tableau, session expirée (couvert par l'e2e « session expirée pendant un dépôt », vert), essais iPhone réels (clavier iOS), mobile en WebKit.

### Ménage
- Tâches créées par les parcours e2e : mises à la corbeille par les parcours eux-mêmes (aucun échec de nettoyage rapporté).
- Tâches créées à la main (script mobile « QA renommer… ») : 3 exécutions du script (2 interrompues par une erreur de mon script), toutes mises à la corbeille (le compteur « À faire » est revenu à 7).
- Langue du compte e2e remise en français. Serveur `next start` du port 3100 arrêté par son PID. Aucun fichier source modifié.

- Rejeu a636cbc : seule la carte déplacée au clavier a été touchée, remise dans « À faire » ; aucune tâche créée. Serveur du port 3100 laissé en place (arrêt par Antoine).
