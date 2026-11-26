# Plan — Kanban des tâches, parente et relations (BRAIN-46)

**Spec** : `spec.md` · **Créé le** : 2026-11-25 · **Démo préalable** : `demo-plan.md` (D1–D9 faites)

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = security-auditor passe après le reviewer. -->

Livraison en deux PR (décision d'Antoine, 2026-11-25) :
- **PR A** — bloc A seul (données et registre, aucun écran), branche `feat/todo-kanban-donnees` partie de `main`. Antoine relit les migrations avant la fusion. Arrêt après l'ouverture de la PR.
- **PR B** — blocs B, C et D, branche `feat/todo-kanban` (PR #14), mise à jour depuis `main` une fois la PR A fusionnée. Arrêt à la tâche 11 : Antoine valide les teintes de priorité sur la preview.

Règles communes à toutes les tâches :
- Appui long, capteurs, délai de 250 ms, soulèvement et inclinaison de `SortableBoard` : validés, intouchés. `@dnd-kit/*` importé par `SortableBoard.tsx` seul.
- Aucune nouvelle dépendance (les clés d'ordre sont écrites dans le module, tâche 2 ; la liste de sélection reprend `Autocomplete` de Base UI, déjà là).
- Migrations additives, générées par `pnpm db:generate`, appliquées sur la branche de test ; jamais sur `production` à la main (ADR-010).
- Chaque test de lecture place une tâche à la corbeille dans sa fixture et vérifie qu'elle n'apparaît pas.
- Relecture : une faille se corrige dans la tâche ; un durcissement va en ticket.
- Commits de chemins précis, jamais `git commit -a` ; sorties de commandes qui touchent une base masquées par `sed` ; aucune adresse de connexion dans une sortie ; processus d'arrière-plan fermés à la fin de chaque tâche.
- Constats de `/impeccable critique` du 2026-11-25 (24/40) repris dans les tâches 11 à 15, 22 et 24 ; archive `.impeccable/critique/`.

## Tâches

### A. Données et registre (PR A)

- [x] **1. Ajouter la clé d'ordre et ouvrir la parente en écriture** [security] — terminée le 2026-11-25 (`fff30aa`)
  - Fichiers : `src/db/schema/tasks.ts`, `drizzle/0008_*.sql` (générée, complétée pour `COLLATE "C"`, l'index partiel et les GRANT)
  - Contenu : `tasks.sort_key text COLLATE "C"` nullable ; index partiel `(workspace_id, status_category, sort_key)` sur `deleted_at IS NULL` ; `GRANT INSERT (sort_key)`, `GRANT UPDATE (sort_key, parent_id)` à `app_backend`. Rien d'autre.
  - Test à écrire d'abord : `tests/db/tasks-sort-key.test.ts` (connexion `app_backend`) — « `app_backend` écrit `sort_key` et `parent_id`, toujours pas `workspace_id` ni `origin` ; "B" se range avant "a" (ordre octet) ; une insertion sans `sort_key` passe (ancien code) ; une parente de l'autre côté est refusée par la clé étrangère »
  - Fini quand : migration appliquée sur la branche de test, test vert, `pnpm test` vert.

- [x] **2. Écrire les clés d'ordre fractionnaires** — terminée le 2026-11-25 (`400c76d`)
  - Fichiers : `src/modules/tasks/sort-key.ts`, `src/modules/tasks/sort-key.test.ts`
  - Contenu : fonctions pures `keyBetween(before | null, after | null)` et `keysFor(count)` ; alphabet en ordre ASCII, jamais de clé finissant par le plus petit caractère, longueur bornée raisonnablement. Sans zod, sans base.
  - Test à écrire d'abord : `sort-key.test.ts` — « la clé rendue est strictement entre ses voisines ; 1 000 insertions aléatoires gardent un ordre total ; 200 insertions au même endroit (tête, queue, entre deux mêmes voisines) restent ordonnées ; voisines égales ou inversées → erreur »
  - Fini quand : tests verts, dont le test aléatoire à graine fixe.

- [x] **3. Créer la table des relations** [security] — terminée le 2026-11-25 (`7b09bc7`)
  - Fichiers : `src/db/schema/tasks.ts` (ou `task-relations.ts`), `drizzle/0009_*.sql`
  - Contenu : `task_relations` selon spec « Données et sécurité » : FK composites vers `tasks(workspace_id, id)`, CHECK `kind`, CHECK pas soi-même, CHECK ordre des identifiants pour `related`, unique, index `(workspace_id, to_task_id)`, RLS activée dans la même migration, policies SELECT, INSERT, DELETE (pas d'UPDATE), GRANT `app_backend` SELECT, INSERT (colonnes utiles), DELETE, trigger `updated_at`. Pas de colonne de côté (règle tenue par les mutations, tâche 8).
  - Test à écrire d'abord : `tests/db/isolation-task-relations.test.ts` (branche de test, `app_backend`, deux workspaces) — « B ne lit, n'insère ni ne supprime aucune relation de A ; une relation entre une tâche de A et une tâche de B est refusée ; relation avec soi-même refusée ; UPDATE refusé »
  - Complément de relecture de la tâche 1 : `tests/db/isolation-tasks.test.ts` — « depuis B, `update tasks set sort_key` et `set parent_id = null` sur une tâche de A touchent 0 ligne ; rattacher une sous-tâche de B à une tâche de A est refusé (23503) »
  - Fini quand : migration appliquée sur la branche de test, RLS + une policy par verbe, test vert.

- [x] **4. Déplacer une tâche ou une sous-tâche dans le tableau (`moveTask`)** [security] — terminée le 2026-11-25 (`42119a3`)
  - Fichiers : `src/modules/tasks/mutations.ts`, `schemas.ts` (`moveTaskInputSchema`), `mutations-move.test.ts` (tests de la tâche)
  - Contenu : statut + place selon spec « Ordre manuel » : verrou d'ordre du workspace, tâche verrouillée, voisines relues sous ce verrou, clés données une fois à toutes les tâches actives de la catégorie (sous-tâches comprises) si la colonne en manque, voisine périmée → tête de colonne, `completed_at` comme `updateTask`, position ignorée dans Terminée et Annulée. Une sous-tâche se déplace comme une tâche, sans effet sur sa parente.
  - Test à écrire d'abord : `mutations.test.ts` — « entre deux voisines ; en tête ; en queue ; colonne sans clés normalisée dans l'ordre de la liste, sous-tâches comprises ; voisine à la corbeille → tête ; vers Terminée ou Annulée pose la date ; en sortir la vide ; sous-tâche déplacée, parente inchangée ; tâche d'un autre workspace → `not_found` »
  - Fini quand : tests verts sur la branche de test.

- [x] **5. Placer en tête de colonne les arrivées hors dépôt** — terminée le 2026-11-25 (`6cf755a`)
  - Fichiers : `src/modules/tasks/mutations.ts`, `mutations-move.test.ts` (tests de la tâche)
  - Contenu : création (tâche ou sous-tâche), changement de statut par `updateTask`, `completeTask` puis réouverture, restauration : en tête si la colonne ouverte d'arrivée a déjà des clés, sans clé sinon. Une seule fonction interne partagée avec la tâche 4.
  - Test à écrire d'abord : « tâche créée dans une colonne ordonnée → première ; dans une colonne sans clé → sans clé ; réouverte → première de À faire ; sous-tâche créée → première »
  - Fini quand : tests verts, aucun test existant de `mutations.test.ts` modifié dans son intention.

- [x] **6. Faire hériter la priorité à la création d'une sous-tâche** — terminée le 2026-11-25 (`b0531ab`)
  - Fichiers : `src/modules/tasks/mutations.ts`, `schemas.ts` (description de `priority` et de `parentId`), `mutations.test.ts`, `messages/en.json` (description de `tasks.create`)
  - Contenu : `createTask` avec `parentId` et sans `priority` → priorité de la parente (lue sous le verrou existant) ; `priority` donnée → respectée, 0 compris ; tags jamais hérités ; aucun suivi ensuite.
  - Test à écrire d'abord : « sous-tâche sans priorité sous une parente Haute → Haute ; avec `priority: 0` → Aucune ; tags de la parente absents ; changer la parente ensuite ne change pas la sous-tâche »
  - Fini quand : tests verts ; la description lue par un modèle dit la règle.

- [x] **7. Rattacher, changer de parente, détacher (`setTaskParent`)** [security] — terminée le 2026-11-25 (`2111ba3`)
  - Fichiers : `src/modules/tasks/mutations.ts`, `schemas.ts`, `errors.ts` (`has_subtasks`, `cross_side_parent`), `mutations-parent.test.ts` (tests de la tâche), `messages/{fr,en}.json` (`tasks.errors.*`)
  - Contenu : règles de spec « Tâche parente » ; même côté exigé, refus avant l'écriture ; espace aligné dans la même instruction que `parent_id` ; statut, place, priorité, tags et relations inchangés ; `restoreTask` refuse une sous-tâche dont la parente est devenue sous-tâche (`subtask_depth`). `restoreTask` relit `parent_id` après le verrou de la tâche (la parente peut désormais changer entre la lecture et le verrou) ; le commentaire « parent_id n'est jamais modifié » de `mutations.ts` est corrigé.
  - Test à écrire d'abord : « rattachée, elle prend l'espace de la parente ; parente de l'autre côté → `cross_side_parent`, rien d'écrit ; parente déjà sous-tâche → `subtask_depth` ; tâche avec sous-tâches actives → `has_subtasks` (avec seulement des sous-tâches à la corbeille → accepté) ; elle-même → `invalid_params` ; parente à la corbeille → `parent_in_trash` ; parente d'un autre workspace → `not_found` ; détachée, elle garde côté, espace et place ; restauration refusée en profondeur 2 »
  - Fini quand : tests verts ; messages anglais des nouveaux codes dans `TASK_ERROR_MESSAGES`.

- [x] **8. Ajouter et retirer une relation** [security] — terminée le 2026-11-25 (`5b8a46f`)
  - Fichiers : `src/modules/tasks/mutations.ts`, `schemas.ts`, `errors.ts` (`relation_conflict`, `cross_side_relation`), `mutations-relations.test.ts` (tests de la tâche), `messages/{fr,en}.json`
  - Contenu : `addTaskRelation`, `removeTaskRelation` ; `kind` d'entrée `blocks | blocked_by | related` ramené à `blocks` orienté ou `related` normalisé ; les deux tâches verrouillées, actives et du même côté ; doublon sans effet ; inverse direct d'un blocage refusé ; sous-tâche et parente reliables.
  - Test à écrire d'abord : « `blocked_by` range la relation dans l'autre sens ; `related` rangée une fois quel que soit l'ordre ; doublon → une seule ligne ; inverse → `relation_conflict` ; côtés différents → `cross_side_relation`, rien d'écrit ; une sous-tâche bloque sa parente ; soi-même → `invalid_params` ; tâche à la corbeille ou d'un autre workspace → `not_found` ; retrait d'une relation absente → `not_found` »
  - Fini quand : tests verts.

- [x] **9. Lire le tableau, les relations et « bloquée »** — terminée le 2026-11-25 (`b5857f2`)
  - Fichiers : `src/modules/tasks/queries.ts`, `schemas.ts` (`boardFilterSchema`, `topLevelOnly` dans `listTasksFilterSchema`), `load.ts` (`loadBoard`), `queries-board.test.ts` (tests de la tâche)
  - Contenu : `listBoard` : sous-tâches en cartes avec `parentTitle`, `includeSubtasks` (vrai) et `hideCompletedSubtasks` (faux) ; colonnes ouvertes ordonnées, plafond 200 et drapeau de dépassement ; Terminée et Annulée par `completed_at` décroissant, limites 20 par défaut, totaux qui suivent les options ; `Task.blocked` (bloquante active, ouverte, du même côté ; tâche ouverte) ; `Task.subtaskOpen` ; `TaskDetail.relations` groupées (`blocks`, `blockedBy`, `related`), autre bout actif et du même côté, avec titre et statut ; `topLevelOnly`.
  - Test à écrire d'abord : « ordre par clé puis ordre de la liste pour les sans-clé, sous-tâche entre deux tâches ; corbeille absente ; `includeSubtasks: false` → premier niveau seulement ; `hideCompletedSubtasks` retire les sous-tâches terminées et corrige le total, pas les annulées ; 20 terminées, 20 annulées et les totaux ; `blocked` faux quand la bloquante est terminée, annulée, à la corbeille ou passée de l'autre côté ; relation masquée puis revenue (corbeille, côté) ; filtre côté et espace ; `topLevelOnly` »
  - Fini quand : tests verts ; `sortKey` absent des types exportés.

- [x] **10. Déclarer les actions au registre** [security] — terminée le 2026-11-25 (`251048f`)
  - Fichiers : `src/modules/tasks/actions.ts`, `actions.test.ts`, `src/modules/actions/registry.test.ts`, `src/modules/actions/isolation.test.ts`, `messages/{fr,en}.json` (`actions.tasks.*`)
  - Contenu : `tasks.move`, `tasks.setParent`, `tasks.addRelation`, `tasks.removeRelation` (write), `tasks.listBoard` (read), canaux web et assistant ; description anglaise qui dit quand utiliser l'action et ses refus, règle du même côté comprise ; `describe` sur chaque champ.
  - Test à écrire d'abord : `actions.test.ts` — « les cinq actions sont dans `toToolDefinitions` avec un schéma JSON où chaque propriété a une description ; l'origine vient du contexte ; chaque code d'erreur a un message anglais » ; `isolation.test.ts` — « depuis la session B, aucune des cinq n'agit sur une tâche de A »
  - Fini quand : tables exhaustives de `registry.test.ts` à jour, tests verts, PR A ouverte vers `main`.

### B. Charte et tableau (PR B)

- [x] **11. Amender la charte : teintes de priorité, Creux, exceptions** — terminée le 2026-11-25 (`d765194`), teintes refaites le même jour sur l'échelle rouge, orangé, jaune, vert (`70259ea`)
  - Fichiers : `DESIGN.md` (frontmatter, § 2, § 5), `src/app/globals.css`, `src/lib/utils.ts` et son test si un token de taille change, `src/components/tasks/priority-icons.ts` (teinte par niveau), test de verrou des tokens
  - Contenu : quatre paires fond et texte `priority-urgent | high | medium | low`, pastel très léger, sur l'échelle rouge, orangé, jaune, vert demandée par Antoine le 2026-11-25 ; rouge distinct de la braise (qui reste le texte du retard et des erreurs), orangé voisin de la pastille d'espace chaude et séparé d'elle par la forme et l'icône ; règle « jamais la couleur seule » ; surfaces Creux (colonne, carte, survol, empreinte) ; exceptions gardées (ligne d'ajout de sous-tâche, « Notes » semi-gras, 46 px, ombre de saisie) ; « icônes de priorité à l'encre » remplacée.
  - Test à écrire d'abord : `priority-icons.test.ts` — « chaque niveau 1 à 4 a une icône et une teinte distinctes, 0 n'a rien ; chaque token existe dans `globals.css` » ; contraste texte et icône ≥ 4,5:1 calculé dans le test à partir des valeurs.
  - Fini quand : tests verts ; planche des quatre teintes visible sur la preview, dans les réglages repliés de la démo (badge, pastille du détail, voisinages avec l'espace chaud et une date en retard). **Arrêt : validation à l'œil par Antoine avant la tâche 12.**

- [x] **12. Appliquer la teinte de priorité partout** — terminée le 2026-11-26 (`8292307`), teintes et badge validés par Antoine sur iPhone le même jour
  - Fichiers : `src/components/tasks/TaskLegendItems.tsx`, `TaskRow.tsx`, `ChoiceChip.tsx` (fond par option), `TaskDetail.tsx`, tuiles (`SideTodoTile`), tests associés
  - Contenu : badge teinté avec icône sur carte, ligne et tuile ; pastille et menu teintés dans le détail ; libellé gardé pour le lecteur d'écran ; badge toujours accroché à la dernière information.
  - Test à écrire d'abord : `TaskList.test.tsx`, `ChoiceChip.test.tsx` — « priorité 2 : classe de teinte haute et icône ; priorité 0 : ni teinte ni icône ; menu : une teinte par option »
  - Fini quand : tests verts ; captures 390 px et 1280 px regardées.

- [x] **13. Renforcer survol et empreinte, Creux par défaut** — terminée le 2026-11-26 (`195c93b`)
  - Fichiers : `src/components/kanban/SortableBoard.tsx`, `SortableBoard.test.tsx`, `e2e/demo-kanban.spec.ts`
  - Contenu : surface Creux par défaut de `SortableBoard` (la variante Verre disparaît) ; survol (pointeur fin) : contour `input`, `shadow-glass`, translation de 2 px par le ressort du survol de tuile, rien en mouvement réduit ni au doigt ; empreinte : fond distinct de la colonne et pointillé 2 px ; légende d'une carte fermée atténuée. Capteurs, délai, soulèvement non touchés.
  - Test à écrire d'abord : e2e ordinateur — « ombre et contour calculés diffèrent entre repos et survol ; pointillé de l'empreinte ≥ 3:1 contre la colonne (lecture de pixels) »
  - Fini quand : e2e de la démo verts (desktop, mobile), unitaires verts.

- [x] **14. Rendre la cible de dépôt lisible sur mobile** — terminée le 2026-11-26 (`58d753f`)
  - Fichiers : `src/components/kanban/SortableBoard.tsx`, `SortableBoard.test.tsx`, `e2e/demo-kanban.spec.ts`
  - Contenu : onglet survolé pendant un glisser = état actif complet et amené dans le champ ; amorce visible quand des onglets sont hors écran ; en-tête de colonne masqué visuellement sous 768 px (l'onglet le dit déjà).
  - Test à écrire d'abord : unitaire — « onglet cible marqué pendant le glisser » ; e2e mobile au doigt — « l'onglet visé est visible et marqué pendant le glisser »
  - Fini quand : e2e de la démo verts ; les e2e D4 (pas de saut du tableau) toujours verts.

- [x] **15. Rendre une colonne repliable sur place (Annulée)** — terminée le 2026-11-26 (`079239b`)
  - Fichiers : `src/components/kanban/SortableBoard.tsx`, `SortableBoard.test.tsx`, `e2e/demo-kanban.spec.ts`, `messages/{fr,en}.json` (`kanban.*`)
  - Contenu : `BoardColumn.collapsible` avec `collapsed` et `onCollapsedChange` : à partir de 768 px, bandeau étroit avec compteur et bouton (`aria-expanded`, nom « libellé, n, déplier / replier »), cible de dépôt replié comme déplié, colonne normale une fois dépliée ; sous 768 px, l'onglet se comporte comme les autres, sans bandeau. Générique, rien de propre aux tâches.
  - Test à écrire d'abord : « bouton déplie et replie, au clic et au clavier ; dépôt sur le bandeau replié ; dépôt dans la colonne dépliée ; sous 768 px, panneau d'onglet normal » ; e2e de la démo adaptés
  - Fini quand : tests et e2e verts ; aucun avertissement d'hydratation.

- [x] **16. Écrire la carte d'une tâche réelle** — terminée le 2026-11-26 (`7c7c044`)
  - Fichiers : `src/components/tasks/TaskCard.tsx`, `TaskCard.test.tsx`, `BlockedChip.tsx` (pastille partagée avec la démo), `messages/{fr,en}.json` (`tasks.blocked`, `tasks.card.*`)
  - Contenu : reprise de `KanbanDemoCard` sur le type `Task` : titre, parente en légende (sous-tâche), « Bloquée », espace (selon `showContext`), échéance, tags, compteur de sous-tâches avec signal des ouvertes (« n ouvertes » sur une parente fermée), priorité teintée ; aucun appel serveur.
  - Test à écrire d'abord : « sous-tâche avec le titre de sa parente ; parente terminée avec 2 ouvertes ; tâche bloquée ; en retard ; terminée (titre et légende atténués) ; sans légende ; EN »
  - Fini quand : tests verts.

- [x] **17. Extraire la file des déplacements optimistes** — terminée le 2026-11-26 (`98f25fc`)
  - Fichiers : `src/components/kanban/use-board-moves.ts`, `use-board-moves.test.ts`, `src/components/kanban/board-moves.ts` + test (application d'un déplacement à un tableau d'identifiants : générique, rien de propre aux tâches), démo (`KanbanDemo.tsx`, `demo-board.ts`)
  - Contenu : logique de `KanbanDemo` rendue générique : affiché = enregistré + déplacements en attente, envois en série, échec → retour et message, échec dépassé ignoré, Réessayer ; l'enregistrement est une fonction passée en paramètre.
  - Test à écrire d'abord : tests de `KanbanDemo.test.tsx` portés — « dépôt optimiste ; deux dépôts en série ; échec puis retour ; échec dépassé sans message ; Réessayer »
  - Fini quand : tests verts ; la démo utilise le hook sans changer de comportement.

- [x] **18. Mémoriser la vue Liste ou Tableau** — terminée le 2026-11-26 (`a05bdb4`)
  - Fichiers : `src/lib/preferences.ts`, `src/lib/tasks-view.ts`, `src/lib/preferences-actions.ts` (`setTasksView`), `src/components/tasks/ViewSwitch.tsx` + test, `messages/{fr,en}.json`
  - Contenu : cookie `bmb_tasks_view` (`list` par défaut, valeur inconnue → `list`) ; pilule à deux segments du modèle de la bascule Privé / Pro, `aria-pressed`, zones ≥ 44 px.
  - Test à écrire d'abord : « valeur lue, défaut, valeur inconnue ; clic sur Tableau enregistre et rafraîchit »
  - Fini quand : tests verts ; le sélecteur n'est pas encore branché sur une vue.

- [x] **19. Mémoriser les options du tableau** — terminée le 2026-11-26 (`fe1645b`)
  - Fichiers : `src/lib/preferences.ts`, `src/lib/tasks-view.ts`, `src/lib/preferences-actions.ts` (`setBoardOption`), `src/components/tasks/BoardOptions.tsx` + test, `messages/{fr,en}.json`
  - Contenu : trois cookies : sous-tâches visibles (vrai par défaut), sous-tâches terminées masquées (faux), Annulée dépliée (faux) ; interrupteurs « Sous-tâches » et « Masquer les sous-tâches terminées » du modèle « Terminées », le second désactivé quand le premier est éteint ; rangée qui ne pousse pas la première carte sous la barre d'onglets à 390 px.
  - Test à écrire d'abord : « défauts ; valeurs inconnues → défauts ; bascule enregistre et rafraîchit ; second interrupteur désactivé »
  - Fini quand : tests verts.

- [x] **20. Afficher le tableau sur `/tasks`** — terminée le 2026-11-26 (`f89d513` tableau, `8e577d2` page et « Tout voir », `20bf1f1` givre et DESIGN.md) ; constat à traiter avant l'essai sur ordinateur : dépôt dans une colonne ouverte vide ou courte quand le tableau est haut (collision `closestCorners` de `SortableBoard`, fichier figé)
  - Fichiers : `src/app/(app)/tasks/(list)/page.tsx`, `(list)/loading.tsx`, `src/components/tasks/TaskBoard.tsx` + test, `src/components/tasks/list-query.ts`
  - Contenu : vue Tableau = `loadBoard` (options de la tâche 19) + `SortableBoard` + `TaskCard` + `use-board-moves` branché sur `tasks.move` ; « Tout voir » de Terminée et d'Annulée ; Annulée repliable (tâche 15) avec son état mémorisé ; ouverture du détail par la route existante, requête gardée ; givre de chargement du tableau ; interrupteur « Terminées » en vue liste seulement ; message de plafond.
  - Test à écrire d'abord : `TaskBoard.test.tsx` — « cinq colonnes ; dépôt → `tasks.move` avec les voisines ; échec → message ; Tout voir ; Annulée dépliée selon la préférence » ; `loading.test.tsx` du tableau
  - Fini quand : tests verts ; tableau utilisable sur `pnpm dev` avec de vraies tâches.

- [x] **21. Prouver le tableau en e2e** — terminée le 2026-11-26 (`986434e`), 27 tests verts deux fois de suite (ordinateur et mobile) ; « Tout voir » non joué (moins de 21 tâches terminées sur le compte e2e) ; restent dans la démo pour la tâche 27 : colonne vide et haute, glisser au doigt en colonnes (1024 px), défilement au doigt avant 250 ms, amorce et encre des onglets coupés, contraste de l'empreinte, survol en mouvement réduit et après Échap
  - Fichiers : `e2e/todo-kanban.spec.ts`, `e2e/todo.ts` (aides)
  - Contenu : scénarios 1 à 5 et 7 de la spec : déplacement gardé au rechargement (souris et doigt), ordre gardé à travers un changement de filtre et le masquage des sous-tâches, Terminée et Annulée (bandeau, dépliée, onglet), échec réseau puis Réessayer, clavier, sous-tâches en cartes et les deux interrupteurs ; console sans avertissement.
  - Test à écrire d'abord : ce fichier, rouge tant que la tâche 20 n'est pas complète sur un point.
  - Fini quand : verts en `--project=desktop --project=mobile --workers=1`, tâches créées remises à la corbeille.

- [x] **22. Porter le contraste Creux dans la vue liste** — terminée le 2026-11-26 (`dadd08d`) ; creux par section sans verre, contour des lignes tracé vers l'intérieur (hauteurs inchangées), corbeille inchangée
  - Fichiers : `src/components/tasks/TaskList.tsx`, `TaskRow.tsx`, `task-list-layout.ts`, givre de la liste, tests et `e2e/effets-de-verre.spec.ts`
  - Contenu : lignes `popover` bordées sur fond `pill-track`, en-têtes de section à l'encre ; les tuiles du tableau de bord gardent leurs lignes actuelles ; hauteurs du givre identiques au pixel. Structure de la liste inchangée (pas d'imbrication des sous-tâches).
  - Test à écrire d'abord : `TaskList.test.tsx` — « surface des lignes de la liste, variante `tile` inchangée » ; e2e du givre inchangés et verts
  - Fini quand : tests et e2e du givre verts ; captures regardées.

### C. Détail (PR B)

- [ ] **23. Rendre le titre éditable d'un tap**
  - Fichiers : `src/components/tasks/TaskDetail.tsx`, `TaskTitleField.tsx` + test, `TaskNotesField.tsx`, `TaskDetail.test.tsx`
  - Contenu : titre au style de titre, libellé `sr-only`, repère d'édition visible au repos, survol `pill-track`, focus en champ net, `text-balance` ; Entrée ou sortie du champ enregistre (inchangé) ; restes de D9 : notes faites de retours à la ligne (plus de rétrécissement au départ du champ), compte d'appels asserté.
  - Test à écrire d'abord : « repère présent ; Entrée enregistre une fois ; vide → erreur et valeur d'avant ; notes "\n\n\n\n" puis clic sur la corbeille en un clic (e2e `todo-detail-notes`) »
  - Fini quand : tests et e2e du détail verts ; essai sur iPhone demandé à Antoine (clavier au tap).

- [ ] **24. Écrire la liste de sélection de tâche**
  - Fichiers : `src/components/tasks/TaskPicker.tsx` + test, `src/app/(app)/tasks/actions.ts` (lecture par `tasks.list`), `messages/{fr,en}.json`
  - Contenu : `Autocomplete` de Base UI, recherche par titre avec délai, 20 résultats, toujours limitée au côté de la tâche ouverte, exclusions passées en props, chaque ligne : titre + icône de statut + pastille d'espace ; états vide / chargement / erreur, clavier, focus rendu, relais de focus iOS si la liste s'ouvre dans un popup. Recherche : statuts ouverts d'abord ; `tasks.list` trie par échéance, donc deux lectures (ouvertes, puis closes pour compléter jusqu'à 20) ou un tri dédié, à décider dans la tâche.
  - Test à écrire d'abord : « filtre par titre ; demande le côté de la tâche ; exclut la tâche et les identifiants donnés ; `topLevelOnly` demandé pour une parente ; espace affiché ; Entrée choisit ; Échap rend le focus »
  - Fini quand : tests verts ; essai clavier iPhone demandé à Antoine.

- [ ] **25. Ajouter la propriété « Tâche parente »**
  - Fichiers : `src/components/tasks/TaskDetail.tsx`, `ParentField.tsx` + test, `TaskDetail.test.tsx`, `e2e/todo-parente.spec.ts`, `messages/{fr,en}.json`
  - Contenu : ligne de propriété après Tags ; une seule mention de la parente (le lien du haut disparaît, « Comme la tâche parente » rejoint cette ligne) ; lien vers la parente, « Détacher », changer ; désactivée avec la raison si la tâche a des sous-tâches ; erreurs du registre sous le champ.
  - Test à écrire d'abord : « rattacher appelle `tasks.setParent` ; détacher ; désactivée avec sous-tâches ; `subtask_depth` et `cross_side_parent` traduits » ; e2e scénario 8
  - Fini quand : tests et e2e verts (desktop, mobile).

- [ ] **26. Ajouter la section « Relations » et « Bloquée » dans la liste**
  - Fichiers : `src/components/tasks/RelationList.tsx` + test, `TaskDetail.tsx`, `TaskRow.tsx` (pastille « Bloquée »), `e2e/todo-relations.spec.ts`, `messages/{fr,en}.json`
  - Contenu : section sous les sous-tâches ; groupes non vides seulement ; ligne « + Ajouter une relation » : type puis tâche (`TaskPicker`) ; chaque relation : lien, icône de statut, « Retirer » ; vide = la seule ligne d'ajout.
  - Test à écrire d'abord : « ajout `blocked_by` → `tasks.addRelation` ; affichée inversée chez l'autre ; retirer ; `relation_conflict` et `cross_side_relation` traduits ; ligne de liste bloquée » ; e2e scénarios 9 et 10
  - Fini quand : tests et e2e verts.

### D. Clôture (PR B)

- [ ] **27. Retirer la démo et aligner les docs**
  - Fichiers : suppression de `src/app/(app)/demo/kanban/`, `e2e/demo-kanban*.spec.ts`, messages `kanbanDemo` ; `tests/build/no-demo.test.ts` (`ALLOWED_DEMOS` vide), `tests/lint/boundaries.test.ts` ; `docs/features/todo-unifiee/spec.md` (tranche 2 renvoyée ici, « En attente » remplacé par « Bloquée », parente modifiable, priorité héritée), `docs/roadmap.md`
  - Test à écrire d'abord : `no-demo.test.ts` — « aucune démo admise »
  - Fini quand : `pnpm test`, `pnpm test:build`, `pnpm lint`, `pnpm typecheck` verts ; les e2e utiles de la démo (saut du tableau D4, tap contre appui long D5, curseur D6, colonne repliable) vivent dans `e2e/todo-kanban.spec.ts`.

- [ ] **28. Passer la revue de design et la suite complète**
  - Fichiers : aucun prévu ; corrections ciblées si la revue en demande
  - Contenu : anti-slop (`nexxia-design`), `/impeccable critique` sur le tableau et le détail (objectif : au-dessus de 24/40, aucun P1), suite e2e complète, e2e `todo-chargement` sur `next start`, langue EN.
  - Fini quand : rapport de critique archivé, e2e verts hors BRAIN-52, prêt pour `/qa todo-kanban`.

## Tickets à créer (hors de cette tranche)
- Automatismes parente / sous-tâches à la Linear (parente terminée quand toutes ses sous-tâches le sont, et inversement).
- Vue liste : sous-tâches imbriquées sous leur parente.
- Durcissement : côté d'une relation garanti par la base (colonne `side`, clés étrangères composites).
- Relation ou parente entre Privé et Pro : seulement si le besoin apparaît à l'usage.

## Limites connues, hors plan
- Clavier : une carte = un arrêt de tabulation ; pas de raccourci de statut ou de priorité depuis la carte.
- Aucune aide visible au glisser pour le voyant (les consignes existent pour le lecteur d'écran).
- Libellés des propriétés du détail à largeur fixe (disposition validée par Antoine).
- Date d'annulation : une tâche terminée puis annulée garde sa date de clôture.

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
