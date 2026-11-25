# Spec — Kanban des tâches, parente et relations (BRAIN-46)

**Créée le** : 2026-11-25 · **Statut** : validée par Antoine le 2026-11-25 (réponses du jour intégrées), migrations à relire avant fusion · **Plan** : `plan.md`

Tranche 2 de la to-do (`docs/features/todo-unifiee/spec.md`, « Livraison en tranches »). Cette spec fait foi pour le kanban, l'ordre manuel, la parente modifiable et les relations ; `todo-unifiee/spec.md` reste la référence du reste (liste, corbeille, statuts, registre) et est corrigée là où cette spec la contredit.

Décisions d'Antoine reprises ici : démo `/demo/kanban` et ses trois essais (`demo-plan.md`) ; décisions du 2026-11-25 : variante Creux, détail Nouveau, titre éditable d'un tap, priorités en pastel, parente et relations dans le détail, sous-tâches en cartes à part entière (comme Linear), colonne Annulée qui s'ouvre sur place, même côté uniquement pour parente et relations, registre compris. Appui long (250 ms, soulèvement, inclinaison) : validé, intouché.

## Objectif
Antoine voit ses tâches par statut sur un tableau, les fait avancer d'un geste au doigt ou à la souris, et relie les tâches entre elles (parente, bloque, liée à) depuis le détail, sans alourdir la création rapide.

## Hors périmètre
- Automatismes de Linear entre parente et sous-tâches (parente terminée quand toutes ses sous-tâches le sont, et inversement) : ticket.
- Vue liste : inchangée dans cette tranche, hors contraste des lignes ; sous-tâches imbriquées sous leur parente dans la liste : ticket.
- Relation ou parente entre Privé et Pro : refusée partout ; à rouvrir par un ticket si le besoin apparaît à l'usage.
- Statuts personnalisés et colonnes personnalisées (`task_statuses`) : plus tard, additif.
- Plus d'un niveau de sous-tâches.
- Détection des cycles de blocage au-delà de l'inverse direct (A bloque B et B bloque A).
- Glisser une carte sur une autre pour créer une relation ou une sous-tâche ; choix de la parente ou d'une relation dans la création rapide (elle reste : un titre, Entrée).
- Ordre manuel dans la vue liste (elle garde son tri par échéance) et dans les colonnes Terminée et Annulée.
- Ajout d'une tâche depuis une colonne ; filtres propres au tableau (tag, priorité) ; plusieurs tableaux.
- Tuiles du tableau de bord : inchangées, sauf la teinte de priorité (même composant de légende).
- Assignation, calendrier, liens GitHub (BRAIN-32, module calendrier, BRAIN-21).
- Thème sombre des nouvelles teintes : les tokens sont sémantiques, valeurs sombres à définir avec le thème.

## Règles métier

### Tableau
- Une colonne par catégorie de statut, dans l'ordre : À planifier, À faire, En cours, Terminée, Annulée. Libellés existants (`tasks.detail.status.*`).
- Périmètre : côté actif et filtre d'espace courants, comme la liste.
- Cartes : toutes les tâches actives, sous-tâches comprises. Une sous-tâche est une carte à part entière, dans la colonne de son propre statut, avec le titre de sa parente en légende.
- Interrupteur « Sous-tâches » dans le tableau, activé par défaut, mémorisé : éteint, on ne voit que les tâches de premier niveau (parentes et tâches sans sous-tâches).
- Option « Masquer les sous-tâches terminées », à côté, éteinte par défaut, mémorisée : allumée, les sous-tâches au statut Terminée ne sont plus des cartes (les sous-tâches annulées restent dans Annulée). Sans effet quand « Sous-tâches » est éteint.
- La carte d'une parente garde son compteur « n/m » et signale les sous-tâches encore ouvertes : compteur à l'encre avec l'icône de liste tant qu'il en reste ; sur une parente terminée ou annulée qui en a encore, la mention « n ouvertes » en clair.
- Terminer ou annuler une parente qui a des sous-tâches ouvertes reste permis, sans fermeture en cascade.
- Colonnes ouvertes (À planifier, À faire, En cours) : ordre manuel de toutes les cartes, sous-tâches comprises (voir « Ordre »). Plafond de lecture : 200 cartes par colonne, message si dépassé.
- Terminée : les 20 plus récentes par date de clôture, puis « Tout voir (n) » qui affiche tout (plafond 200). Ordre toujours par clôture décroissante.
- Annulée : mêmes règles que Terminée (20 plus récentes par date d'annulation, « Tout voir »). La date d'annulation est `completed_at` ; une tâche terminée puis annulée garde sa date de clôture (règle existante de `updateTask`), limite assumée.
  - À partir de 768 px : bandeau étroit replié avec compteur, cible de dépôt, qui se déplie en colonne normale au clic et se replie de la même façon ; état mémorisé. Bouton avec `aria-expanded` et un nom complet (« Annulée, 3 tâches, déplier »), atteignable au clavier.
  - Sous 768 px : « Annulée » est un onglet comme les autres, avec son compteur, sans bandeau.
  - Les tâches annulées s'y lisent et s'y ouvrent comme ailleurs.
- Déplacer une carte dans une autre colonne = changer son statut (mêmes effets que `tasks.update` : `completed_at` posé ou vidé). Déplacer dans la même colonne ouverte = changer son ordre. Dans Terminée et Annulée, la position du dépôt est ignorée.
- Sous 768 px, l'en-tête de colonne n'est pas répété sous l'onglet ; pendant un glisser, l'onglet visé est marqué et amené dans le champ.
- Tap, clic ou Entrée sur une carte : détail de la tâche, même fenêtre et même adresse que depuis la liste (`/tasks/[id]`), fermeture = retour au tableau.
- Mise à jour optimiste, exception limitée au déplacement : la carte reste où elle est lâchée ; les enregistrements partent dans l'ordre des dépôts ; échec → la carte revient à sa place, animée, et « Déplacement non enregistré. » avec Réessayer. Échec d'un dépôt dépassé par un dépôt plus récent de la même carte : ni retour ni message.
- Vue mémorisée : Liste ou Tableau, par un sélecteur dans l'en-tête de `/tasks`, gardée dans un cookie (comme le côté). Liste par défaut. L'interrupteur « Terminées » n'existe que dans la vue liste.
- Carte : titre (deux lignes au plus), puis légende : parente (sous-tâche), « Bloquée », pastille d'espace, échéance (braise si en retard), tags, compteur de sous-tâches, priorité. La priorité n'est jamais seule sur une ligne.

### Ordre manuel
- `tasks.sort_key` : clé d'ordre fractionnaire, texte comparé octet par octet (`COLLATE "C"`). Une clé se calcule entre deux voisines sans réécrire les autres lignes.
- L'ordre est global par workspace et par catégorie, pour toutes les tâches actives, sous-tâches comprises. Un tableau filtré (espace, sous-tâches masquées) en montre une sous-suite, donc placer une carte entre deux voisines visibles la place entre elles partout. Les sous-tâches en cartes ne changent pas le modèle : une clé par tâche, rien par parente.
- Lecture d'une colonne ouverte : `sort_key` croissant, tâches sans clé ensuite dans l'ordre de la liste (échéance, priorité, création).
- Premier déplacement dans une colonne qui contient des tâches sans clé : la mutation donne d'abord une clé à toutes les tâches actives de cette catégorie dans le workspace, dans l'ordre affiché, puis place la carte. Une fois par colonne, dans la même transaction.
- Arrivée dans une colonne ouverte autrement que par un dépôt (création, changement de statut depuis le détail ou la liste, réouverture, restauration) : en tête de colonne si la colonne a déjà des clés, sans clé sinon. Rattacher ou détacher une tâche ne change ni son statut ni sa place.
- Les écritures d'ordre d'un workspace sont mises en série par un verrou d'ordre (verrou consultatif de transaction, pris avant tout verrou de ligne) ; toute mutation qui écrit plusieurs lignes de `tasks` ou une clé le prend en premier.
- Les voisines (`beforeId`, `afterId`) sont relues sous ce verrou d'ordre : voisine absente, à la corbeille ou d'une autre catégorie → la carte va en tête de la colonne visée, sans erreur (le tableau affiché était périmé).

### Sous-tâches
- À la création, une sous-tâche hérite du côté et de l'espace de sa parente (existant) et de sa priorité quand aucune priorité n'est donnée ; la priorité se modifie ensuite librement. Les tags ne sont pas hérités. Un changement de priorité de la parente ne touche pas ses sous-tâches.

### Tâche parente
- Un seul niveau. Devenir sous-tâche de P exige : P active, de premier niveau, différente de la tâche, du même côté ; la tâche n'a aucune sous-tâche active.
- Même côté uniquement : une parente de l'autre côté est refusée (`cross_side_parent`), à l'écran comme pour un assistant. La base le garantit déjà (clé étrangère `(workspace_id, parent_id, side)`) ; la mutation le refuse avant, avec un code clair.
- La sous-tâche prend l'espace de sa nouvelle parente, dans la même instruction. Sa priorité, ses tags, son statut, sa place et ses relations ne changent pas.
- Détacher (`parentId: null`) : la tâche redevient de premier niveau et garde côté et espace.
- Changer de parente = une seule écriture (pas de détachement intermédiaire).
- Une tâche à la corbeille n'est jamais proposée ni acceptée comme parente (`parent_in_trash`).
- Restaurer une sous-tâche dont la parente est entre-temps devenue sous-tâche est refusé (`subtask_depth`) ; elle se restaure après détachement de sa parente. Limite assumée.
- Refus : `subtask_depth` (parente visée déjà sous-tâche), `has_subtasks` (la tâche a des sous-tâches actives), `cross_side_parent`, `invalid_params` (elle-même), `not_found`, `parent_in_trash`.

### Relations
- Trois types à l'écran : « Bloque », « Bloquée par », « Liée à ». Deux en base : `blocks` (de la bloquante vers la bloquée) et `related` (symétrique, rangée une fois, plus petit identifiant en premier). « Bloquée par » est la lecture inverse de `blocks`.
- Jamais de relation d'une tâche avec elle-même (refus de l'action et CHECK en base).
- Entre deux tâches actives du même workspace et du même côté, sous-tâches comprises. Une relation « bloque » peut relier une sous-tâche à sa parente, dans un sens ou dans l'autre.
- Même côté uniquement, sans exception pour l'assistant : lier deux tâches de côtés différents est refusé (`cross_side_relation`). Règle tenue par la mutation (les deux tâches verrouillées), pas par une contrainte de base.
- Une tâche qui change de côté garde ses relations en base ; celles qui traversent alors les côtés sont masquées à la lecture (détail, « Bloquée », listes), comme une relation vers la corbeille, et reviennent si les côtés coïncident de nouveau.
- Ajouter une relation qui existe déjà : sans effet, sans erreur. Ajouter l'inverse direct d'un blocage existant : refus `relation_conflict`.
- Une relation vers une tâche à la corbeille est masquée partout, pas supprimée ; elle réapparaît à la restauration.
- « Bloquée » (carte, ligne de liste) : la tâche est ouverte et a au moins une bloquante active, ouverte et du même côté. Dérivé à la lecture, pas un statut. Remplace le libellé « En attente » réservé par `todo-unifiee/spec.md`.
- Dans le détail, chaque relation est un lien vers l'autre tâche, avec son statut (icône) et un bouton « Retirer ».

### Listes de sélection (parente, relations)
- Une seule liste à recherche par titre (insensible à la casse), commune aux deux usages. Chaque ligne montre le titre, l'icône de statut et la pastille d'espace.
- Proposées : les tâches actives du même côté que la tâche ouverte. Jamais : la tâche elle-même, la corbeille, l'autre côté.
- Pour la parente : seulement les tâches de premier niveau ; rien du tout si la tâche a des sous-tâches (la propriété explique pourquoi). Pour une relation : sous-tâches comprises, sauf les tâches déjà reliées par ce type.
- Ouverte sans recherche : les tâches ouvertes du côté, dans l'ordre de la liste, 20 au plus. Avec recherche : statuts ouverts d'abord ; les terminées et annulées sont trouvables par leur titre.
- Clavier complet (flèches, Entrée, Échap), focus rendu au déclencheur. Sur iPhone, le clavier s'ouvre au tap (piège du focus synchrone, `docs/gotchas.md`).

### Registre d'actions (ADR-009)
Toutes les écritures ci-dessus passent par le registre, canaux web et assistant, descriptions en anglais (`messages/en.json`) et schémas zod avec `describe` sur chaque champ, lisibles par un modèle. Messages d'erreur anglais par code (`TASK_ERROR_MESSAGES`) : ce qui est refusé et quoi faire. Mêmes règles pour l'écran et pour un assistant, côté compris.

| Action | Accès | Paramètres | Effet |
| --- | --- | --- | --- |
| `tasks.move` | write | `taskId`, `statusCategory`, `beforeId?`, `afterId?` | Statut et place dans la colonne, tâche ou sous-tâche ; renvoie le détail. |
| `tasks.setParent` | write | `taskId`, `parentId` (uuid ou `null`) | Rattache, change de parente ou détache. |
| `tasks.addRelation` | write | `taskId`, `kind` (`blocks`, `blocked_by`, `related`), `otherTaskId` | Crée la relation, idempotent. |
| `tasks.removeRelation` | write | mêmes paramètres | Retire la relation ; absente → `not_found`. |
| `tasks.listBoard` | read | `side`, `contextId?`, `includeSubtasks?` (vrai), `hideCompletedSubtasks?` (faux), `completedLimit?`, `canceledLimit?` | Colonnes du tableau : cartes ordonnées, totaux. |
| `tasks.list` (existante) | read | + `topLevelOnly?` | Sert les listes de sélection (avec `side` et `query`). |
| `tasks.create` (existante) | write | inchangés | Une sous-tâche sans priorité prend celle de sa parente. |
| `tasks.get` (existante) | read | inchangés | Le détail gagne `relations` et `blocked`. |

Nouveaux codes : `has_subtasks`, `cross_side_parent`, `cross_side_relation`, `relation_conflict`. `Task` gagne `blocked` et `subtaskOpen` ; `sortKey` n'est jamais exposé hors du module (l'ordre est celui du tableau renvoyé).

## Critères d'acceptation

Tableau
- [ ] Le sélecteur Liste / Tableau de `/tasks` change la vue ; le choix est gardé d'une visite à l'autre (cookie).
- [ ] Le tableau montre cinq colonnes dans l'ordre, limitées au côté actif et à l'espace filtré ; aucune tâche à la corbeille n'apparaît.
- [ ] Une sous-tâche est une carte dans la colonne de son statut, avec le titre de sa parente en légende ; elle se glisse, se réordonne et s'ouvre comme une autre carte.
- [ ] « Sous-tâches » éteint : plus aucune sous-tâche en carte, les parentes gardent leur compteur. « Masquer les sous-tâches terminées » allumé : aucune sous-tâche dans Terminée, le total de la colonne suit. Les deux choix sont gardés d'une visite à l'autre ; par défaut : sous-tâches visibles, terminées non masquées.
- [ ] Une parente terminée qui a des sous-tâches ouvertes reste terminée, ses sous-tâches gardent leur statut, et sa carte dit combien restent ouvertes.
- [ ] Sous 768 px : une colonne à la fois avec cinq onglets, Annulée comprise, chacun cible de dépôt ; au-delà : colonnes côte à côte à défilement horizontal, sans aimant.
- [ ] Glisser une carte de « À faire » vers « En cours » change son statut ; au rechargement elle y est, à la place du dépôt.
- [ ] Réordonner trois cartes d'une colonne ouverte, dont une sous-tâche, recharger : l'ordre est gardé. Le même ordre relatif est gardé en changeant de filtre d'espace et en masquant puis réaffichant les sous-tâches.
- [ ] Déposer dans Terminée pose la date de clôture, la carte arrive en tête ; déposer sur Annulée (bandeau, colonne dépliée ou onglet) l'annule ; la sortir de Terminée ou d'Annulée vide la date.
- [ ] Terminée et Annulée affichent 20 cartes et « Tout voir (n) » au-delà.
- [ ] À partir de 768 px, le bandeau Annulée se déplie en colonne au clic ou au clavier et se replie de même ; l'état est gardé d'une visite à l'autre ; son nom annoncé dit le compteur et l'action.
- [ ] Échec de l'enregistrement : la carte revient à sa place, « Déplacement non enregistré. » et Réessayer s'affichent ; Réessayer rejoue le dépôt. En mouvement réduit, le retour est sans animation.
- [ ] Deux dépôts rapides partent dans l'ordre ; l'état final après rechargement est celui affiché.
- [ ] Clavier : Entrée ouvre le détail, Espace saisit, flèches déplacent, Espace dépose, Échap annule ; les annonces du lecteur d'écran sont en FR et en EN.
- [ ] Tap court = détail, appui de 250 ms = saisie, défilement = ni l'un ni l'autre (comportements de la démo, inchangés).
- [ ] Une tâche avec une bloquante ouverte porte « Bloquée » sur sa carte et sa ligne de liste ; la pastille disparaît quand la bloquante est terminée, annulée ou à la corbeille.
- [ ] Aucun avertissement ni erreur de console à l'affichage et pendant un glisser (hydratation comprise).
- [ ] `@dnd-kit/*` reste importé par `SortableBoard.tsx` seul.

Cartes (variante Creux)
- [ ] Colonne `pill-track` sans verre, cartes `popover` bordées avec ombre légère, en-tête de colonne à l'encre ; aucun texte secondaire sous 4,5:1 sur la colonne.
- [ ] Au survol (pointeur fin), la carte change visiblement : contour et ombre plus marqués que le repos, mesurables. Rien au doigt.
- [ ] L'empreinte d'une carte saisie se distingue de la colonne : pointillé à 3:1 au moins contre la colonne, fond distinct.
- [ ] La liste `/tasks` suit la même règle : lignes claires et bordées sur un fond teinté ; le givre de chargement garde ses hauteurs au pixel près.

Détail
- [ ] Ordre : titre ; propriétés (Statut, Priorité, Échéance, Côté et espace, Tags, Tâche parente) ; sous-tâches ; relations ; notes ; corbeille. Une sous-tâche n'a pas de bloc sous-tâches.
- [ ] Le titre se modifie d'un tap ou d'un clic dessus, sans bouton ; au repos il se lit comme un titre avec un repère d'édition visible sans survol ; au focus il devient un champ net ; Entrée ou la sortie du champ enregistre ; vide → erreur, valeur d'avant gardée.
- [ ] Chaque niveau de priorité a sa teinte pastel et son icône, partout où une priorité s'affiche (pastille du détail, menu, carte, ligne, tuile) ; « Aucune » n'a ni teinte ni icône propre. Texte et icône ≥ 4,5:1 sur la teinte ; teintes distinctes des pastilles d'espace et de la braise.
- [ ] Une sous-tâche créée sous une parente de priorité Haute naît en priorité Haute, sans ses tags ; changer ensuite l'une ne change pas l'autre.
- [ ] « Tâche parente » : choisir une tâche rattache, l'espace suit ; « Détacher » la rend de premier niveau ; une tâche qui a des sous-tâches voit la propriété désactivée avec la raison ; ni une sous-tâche ni une tâche de l'autre côté n'est proposée.
- [ ] « Relations » : choisir un type puis une tâche crée la relation ; elle apparaît aussi, inversée, dans le détail de l'autre tâche ; « Retirer » l'enlève des deux côtés ; une sous-tâche peut bloquer sa parente.
- [ ] Les listes de sélection filtrent par titre, montrent l'espace de chaque tâche, ne montrent ni la tâche elle-même, ni la corbeille, ni l'autre côté, et s'utilisent au clavier.
- [ ] Notes : une ligne quand elles sont vides, le champ s'agrandit au tap et le reste jusqu'à la fermeture.
- [ ] Ligne « Ajouter une sous-tâche » toujours visible, Entrée valide, prête pour la suivante.

Données et registre
- [ ] `tasks.setParent` refuse : parente sous-tâche, tâche avec sous-tâches actives, elle-même, parente à la corbeille, parente de l'autre côté (`cross_side_parent`), parente d'un autre workspace (`not_found`).
- [ ] `tasks.addRelation` refuse : elle-même, tâche à la corbeille ou d'un autre workspace (`not_found`), tâche de l'autre côté (`cross_side_relation`), inverse direct d'un blocage (`relation_conflict`) ; un doublon ne crée rien.
- [ ] Après un changement de côté, une relation devenue transversale n'apparaît plus nulle part et ne bloque plus ; elle revient si les côtés coïncident de nouveau.
- [ ] `tasks.move` déplace une sous-tâche comme une tâche.
- [ ] Isolation : depuis le workspace B, aucune lecture ni écriture d'une relation, d'une parente ou d'un ordre du workspace A, au niveau de la base (connexion `app_backend`).
- [ ] Les nouvelles actions figurent dans les définitions d'outils (`toToolDefinitions`) avec description et schéma JSON complets ; chaque champ est décrit ; chaque nouveau code a son message anglais.
- [ ] Migrations additives : l'ancien code tourne sur le nouveau schéma (colonnes nullables, table nouvelle, droits ajoutés).

Retrait de la démo
- [ ] `/demo/kanban`, ses messages, ses fixtures et ses e2e sont supprimés ; `pnpm test:build` refuse toute démo.

## Scénarios utilisateur (joués par /qa)
1. **Faire avancer une tâche** — Antoine ouvre `/tasks`, passe en Tableau, glisse une carte de « À faire » à « En cours », recharge : elle y est. Variante mobile : oui (appui long, dépôt sur l'onglet).
2. **Ranger une colonne** — il réordonne trois cartes de « À faire », dont une sous-tâche, change de filtre d'espace puis revient : l'ordre est gardé. Variante mobile : oui.
3. **Terminer et annuler** — il dépose une carte dans Terminée (elle passe en tête), une autre sur le bandeau Annulée (compteur +1), déplie Annulée, y ouvre la tâche, la ramène dans « À faire ». Variante mobile : oui (onglet Annulée).
4. **Échec d'enregistrement** — réseau coupé, il dépose une carte : elle revient, le message s'affiche ; réseau rétabli, Réessayer la déplace. Variante mobile : non.
5. **Clavier** — sans souris : Tab jusqu'à une carte, Espace, flèche droite, Espace ; Entrée ouvre le détail, Échap le ferme ; Tab jusqu'au bandeau Annulée, Entrée le déplie. Variante mobile : non.
6. **Renommer d'un tap** — depuis le tableau, il ouvre une carte, tape sur le titre, le change, Entrée : la carte porte le nouveau titre. Variante mobile : oui.
7. **Sous-tâches sur le tableau** — il crée deux sous-tâches sous une tâche de priorité Haute : elles naissent en Haute, en cartes dans « À faire » avec le titre de la parente ; il en termine une, allume « Masquer les sous-tâches terminées » : elle quitte Terminée ; il éteint « Sous-tâches » : il ne reste que la parente, compteur 1/2. Variante mobile : oui.
8. **Transformer en sous-tâche** — dans le détail d'une tâche Pro sans espace, il choisit comme parente une tâche de l'espace Nexxia : la carte prend l'espace Nexxia et le titre de la parente en légende ; « Détacher » retire la légende. La liste de sélection ne montre aucune tâche Privé. Variante mobile : oui.
9. **Bloquer** — il ajoute « Bloquée par » vers une autre tâche : la carte porte « Bloquée » ; il termine la bloquante : la pastille disparaît. Variante mobile : oui.
10. **Corbeille** — il met une tâche reliée à la corbeille : elle disparaît des relations et des listes de sélection ; restaurée, la relation revient. Variante mobile : non.
11. **Langue** — en anglais, colonnes, interrupteurs, types de relation, messages d'erreur et annonces sont traduits. Variante mobile : non.

## Données et sécurité
- Tables touchées : `tasks` — nouvelle colonne `sort_key text COLLATE "C"` nullable ; index partiel `(workspace_id, status_category, sort_key)` sur les tâches actives ; droits `app_backend` : INSERT et UPDATE sur `sort_key`, UPDATE sur `parent_id` (jusqu'ici jamais modifiable, `drizzle/0006_tasks.sql`).
- Nouvelle table `task_relations` : `id`, `workspace_id NOT NULL`, `from_task_id`, `to_task_id` (FK composites `(workspace_id, …)` → `tasks(workspace_id, id)`), `kind text CHECK (kind IN ('blocks','related'))`, `created_at`, `updated_at` ; CHECK `from_task_id <> to_task_id` ; CHECK `kind <> 'related' OR from_task_id < to_task_id` ; unique `(workspace_id, from_task_id, to_task_id, kind)` ; index `(workspace_id, to_task_id)`.
- Le côté d'une relation n'est pas une contrainte de base : la table ne porte pas le côté, pour qu'un changement de côté d'une tâche reste possible (relations masquées, pas d'écriture refusée). Durcissement possible plus tard (colonne `side` et clés étrangères composites), en ticket.
- RLS : activée dans la migration de création ; policies SELECT, INSERT, DELETE par appartenance au workspace (`app.is_workspace_member`) ; pas d'UPDATE (une relation s'ajoute ou se retire) ; droits `app_backend` SELECT, INSERT (colonnes utiles), DELETE.
- Deux migrations additives (0008 ordre et droits, 0009 relations), appliquées en production par la CI (ADR-010). Antoine relit les migrations avant la fusion de la PR A.
- Lectures dans `src/modules/tasks/queries.ts` seulement (ADR-004) : tableau, relations du détail, « bloquée », candidates. Toutes partent du prédicat `isActive`, y compris pour l'autre bout d'une relation.
- Écritures dans `mutations.ts` : tâche verrouillée (`lockTask`), ordre sérialisé par workspace (`lockBoardOrder`) ; parente et espace en une instruction.
- Le `workspaceId` vient de la session ; aucun identifiant de workspace dans un paramètre d'action.
- Aucune donnée métier dans un message d'erreur ou de console (`.claude/rules/sentry.md`).
- Préférences d'affichage (vue, sous-tâches, sous-tâches terminées, Annulée dépliée) : cookies, comme le côté ; aucune donnée métier.
- Argent / paiement concerné : non. `security-auditor` obligatoire sur les migrations, les mutations et les actions (tâches `[security]` du plan).

## UI
- Écrans concernés : `/tasks` (en-tête avec sélecteur de vue, vue Tableau, vue Liste pour le contraste des lignes), détail d'une tâche (`TaskDetail`), tuiles To-do du tableau de bord (teinte de priorité seulement). Maquette : la démo `/demo/kanban` validée, variante Creux et détail Nouveau.
- Curseurs nexxia-design : VARIANCE 3 · MOTION 4 · DENSITY 6.
- Composants repris tels quels : `SortableBoard` (capteurs, délai, soulèvement, annonces), `TaskDetailSheet`, `SubtaskAddField`, `TaskNotesField`, `ChoiceChip`, `TaskLegendItems`, `status-icons.ts`.
- Surfaces (Creux) : colonne `bg-pill-track` sans verre ni ombre, en-tête à l'encre ; carte `bg-popover border-border shadow-raised` ; calque du glisser `shadow-glass` ; jamais deux verres empilés ; la barre d'onglets mobile reste en verre.
- Survol et empreinte renforcés, tokens existants seulement : survol = contour `input` + `shadow-glass` + translation de 2 px ; empreinte = fond distinct de la colonne et pointillé plus épais. Valeurs exactes fixées par la tâche de design, mesures à l'appui.
- Options du tableau : « Sous-tâches » et « Masquer les sous-tâches terminées », interrupteurs du modèle « Terminées » (DESIGN.md § 5), sur une rangée au-dessus du tableau qui ne pousse pas la première carte sous la barre d'onglets à 390 px (piège de la démo, `docs/gotchas.md`) ; la seconde est désactivée quand la première est éteinte.
- Bandeau Annulée (≥ 768 px) : colonne étroite repliée, libellé et compteur, bouton pour déplier ; dépliée, colonne normale avec le même bouton pour replier ; cible de dépôt dans les deux états.
- Carte d'une sous-tâche : titre de la parente en première information de la légende, avec l'icône de retour vers la parente déjà utilisée par la liste, tronqué sur une ligne.
- Titre éditable : style de titre (`font-heading text-title`), libellé accessible sans libellé visible, repère d'édition (icône crayon 16 px, encre secondaire) visible au repos ; survol `bg-pill-track` ; focus = champ `border-input bg-row` et anneau ; `text-balance`.
- Priorités en pastel : quatre nouveaux tokens de DESIGN.md § 2 (fond et texte par niveau : urgente, haute, moyenne, basse), déclarés dans `globals.css`, même clarté et même saturation que les pastilles d'espace, teintes choisies hors de celles des espaces et de la braise. L'icône reste : jamais la couleur seule. DESIGN.md amendé (frontmatter, § 2, § 5), la règle « icônes de priorité toujours à l'encre » de `priority-icons.ts` devient « encre du token de la teinte ». Antoine valide les teintes sur la preview avant leur application partout.
- Tâche parente : ligne de propriété, pastille qui ouvre la liste de sélection ; valeur = titre de la parente (lien) et « Détacher ». Une seule mention de la parente dans le détail : le lien du haut d'une sous-tâche disparaît, « Comme la tâche parente » rejoint cette ligne.
- Relations : section sous les sous-tâches, même titre de section ; groupes « Bloque », « Bloquée par », « Liée à » ; ligne d'ajout « + Ajouter une relation » (type, puis tâche), sur le modèle de la ligne d'ajout de sous-tâche ; vide, la section se réduit à cette ligne.
- Liste de sélection : `Autocomplete` de Base UI (déjà utilisé par la palette), popup opaque `popover rounded-lg shadow-glass`, items `min-h-11`.
- Sélecteur de vue : pilule à deux segments du modèle « bascule Privé / Pro » (DESIGN.md § 5), icônes Lucide et libellés.
- Animation : Motion (ADR-006), ressort sans rebond de DESIGN.md § 7 ; `prefers-reduced-motion` respecté.
- Textes : FR et EN, aucun texte en dur (ADR-007). Mobile d'abord, 390 px, zones ≥ 44 px, champs ≥ 16 px (ADR-008).
- Exceptions à la charte gardées (décision du 2026-11-25) : ligne d'ajout de sous-tâche sans libellé visible ; libellé « Notes » en semi-gras ; notes repliées à 46 px ; ombre de saisie `shadow-glass`. À inscrire dans DESIGN.md.
- Constats de `/impeccable critique` du 2026-11-25 (24/40, aucun P0) intégrés : survol et empreinte, cible de dépôt mobile, colonne Annulée atteignable, parente mentionnée une fois, titre, priorité lisible sur la carte.
- Avant livraison : anti-slop (`nexxia-design`) puis `/impeccable critique`.

## Questions ouvertes
- [ ] Quatre teintes de priorité : proposées par la tâche de design, validées à l'œil par Antoine sur la preview avant d'être appliquées partout (arrêt prévu au plan).
- [x] Sous-tâches sur le tableau : cartes à part entière, interrupteur et option de masquage (Antoine, 2026-11-25).
- [x] Colonne Annulée : bandeau qui s'ouvre sur place, onglet sur mobile (Antoine, 2026-11-25).
- [x] Parente et relations : même côté uniquement, registre compris (Antoine, 2026-11-25).
- [x] Vue par défaut : Liste.
