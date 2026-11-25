# Spec — Kanban des tâches, parente et relations (BRAIN-46)

**Créée le** : 2026-11-25 · **Statut** : brouillon, à valider par Antoine · **Plan** : `plan.md`

Tranche 2 de la to-do (`docs/features/todo-unifiee/spec.md`, « Livraison en tranches »). Cette spec fait foi pour le kanban, l'ordre manuel, la parente modifiable et les relations ; `todo-unifiee/spec.md` reste la référence du reste (liste, corbeille, statuts, registre) et est corrigée là où cette spec la contredit.

Décisions d'Antoine reprises ici : démo `/demo/kanban` et ses trois essais (`demo-plan.md`), décisions du 2026-11-25 (variante Creux, détail Nouveau, titre éditable d'un tap, priorités en pastel, parente et relations dans le détail). Appui long (250 ms, soulèvement, inclinaison) : validé, intouché.

## Objectif
Antoine voit ses tâches par statut sur un tableau, les fait avancer d'un geste au doigt ou à la souris, et relie les tâches entre elles (parente, bloque, liée à) depuis le détail, sans alourdir la création rapide.

## Hors périmètre
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
- Périmètre : côté actif et filtre d'espace courants, comme la liste. Cartes = tâches de premier niveau actives ; une sous-tâche n'est pas une carte, sa parente porte le compteur « n/m ».
- Colonnes ouvertes (À planifier, À faire, En cours) : ordre manuel (voir « Ordre »). Plafond de lecture : 200 cartes par colonne, message si dépassé.
- Terminée : les 20 plus récentes par date de clôture, puis « Tout voir (n) » qui affiche tout (plafond 200). Ordre toujours par clôture décroissante.
- Annulée : bandeau replié avec compteur, cible de dépôt, jamais déplié ; il porte un lien vers la liste avec « Terminées », où les annulées se lisent. Étroit sur ordinateur.
- Sous 768 px, l'en-tête de colonne n'est pas répété sous l'onglet ; pendant un glisser, l'onglet visé est marqué et amené dans le champ.
- Déplacer une carte dans une autre colonne = changer son statut (mêmes effets que `tasks.update` : `completed_at` posé ou vidé). Déplacer dans la même colonne ouverte = changer son ordre. Dans Terminée ou sur Annulée, la position du dépôt est ignorée.
- Tap, clic ou Entrée sur une carte : détail de la tâche, même fenêtre et même adresse que depuis la liste (`/tasks/[id]`), fermeture = retour au tableau.
- Mise à jour optimiste, exception limitée au déplacement : la carte reste où elle est lâchée ; les enregistrements partent dans l'ordre des dépôts ; échec → la carte revient à sa place, animée, et « Déplacement non enregistré. » avec Réessayer. Échec d'un dépôt dépassé par un dépôt plus récent de la même carte : ni retour ni message.
- Vue mémorisée : Liste ou Tableau, par un sélecteur dans l'en-tête de `/tasks`, gardée dans un cookie (comme le côté). Liste par défaut. L'interrupteur « Terminées » n'existe que dans la vue liste.
- Carte : titre (deux lignes au plus), puis légende : « Bloquée », pastille d'espace, échéance (braise si en retard), tags, compteur de sous-tâches, priorité. La priorité n'est jamais seule sur une ligne.

### Ordre manuel
- `tasks.sort_key` : clé d'ordre fractionnaire, texte comparé octet par octet (`COLLATE "C"`). Une clé se calcule entre deux voisines sans réécrire les autres lignes.
- L'ordre est global par workspace et par catégorie ; un tableau filtré en montre une sous-suite, donc placer une carte entre deux voisines visibles la place entre elles partout.
- Lecture d'une colonne ouverte : `sort_key` croissant, tâches sans clé ensuite dans l'ordre de la liste (échéance, priorité, création).
- Premier déplacement dans une colonne qui contient des tâches sans clé : la mutation donne d'abord une clé à toutes les tâches actives de premier niveau de cette catégorie, dans l'ordre affiché, puis place la carte. Une fois par colonne, dans la même transaction.
- Arrivée dans une colonne ouverte autrement que par un dépôt (création, changement de statut depuis le détail ou la liste, réouverture, détachement d'une sous-tâche) : en tête de colonne si la colonne a déjà des clés, sans clé sinon.
- Les voisines (`beforeId`, `afterId`) sont relues et verrouillées par la mutation : voisine absente, à la corbeille ou d'une autre catégorie → la carte va en tête de la colonne visée, sans erreur (le tableau affiché était périmé).

### Tâche parente
- Un seul niveau. Devenir sous-tâche de P exige : P active, de premier niveau, différente de la tâche ; la tâche n'a aucune sous-tâche active.
- La sous-tâche prend le côté et l'espace de sa nouvelle parente, dans la même instruction. Ses tags, son statut, ses relations ne changent pas.
- Détacher (`parentId: null`) : la tâche redevient de premier niveau et garde côté et espace.
- Changer de parente = une seule écriture (pas de détachement intermédiaire).
- Une tâche à la corbeille n'est jamais proposée ni acceptée comme parente (`parent_in_trash`).
- Restaurer une sous-tâche dont la parente est entre-temps devenue sous-tâche est refusé (`subtask_depth`) ; elle se restaure après détachement de sa parente. Limite assumée.
- Refus : `subtask_depth` (parente visée déjà sous-tâche), `has_subtasks` (la tâche a des sous-tâches actives), `invalid_params` (elle-même), `not_found`, `parent_in_trash`.

### Relations
- Trois types à l'écran : « Bloque », « Bloquée par », « Liée à ». Deux en base : `blocks` (de la bloquante vers la bloquée) et `related` (symétrique, rangée une fois, plus petit identifiant en premier). « Bloquée par » est la lecture inverse de `blocks`.
- Jamais de relation d'une tâche avec elle-même (refus de l'action et CHECK en base).
- Entre deux tâches actives du même workspace, sous-tâches comprises, quel que soit leur côté. La liste de sélection ne propose que le côté de la tâche ouverte (« Privé / Pro, jamais mélangés ») ; une relation qui traverse les côtés après un changement de côté reste affichée.
- Ajouter une relation qui existe déjà : sans effet, sans erreur. Ajouter l'inverse direct d'un blocage existant : refus `relation_conflict`.
- Une relation vers une tâche à la corbeille est masquée partout, pas supprimée ; elle réapparaît à la restauration.
- « Bloquée » (carte, ligne de liste) : la tâche est ouverte et a au moins une bloquante active et ouverte. Dérivé à la lecture, pas un statut. Remplace le libellé « En attente » réservé par `todo-unifiee/spec.md`.
- Dans le détail, chaque relation est un lien vers l'autre tâche, avec son statut (icône) et un bouton « Retirer ».

### Listes de sélection (parente, relations)
- Une seule liste à recherche par titre (insensible à la casse), commune aux deux usages. Elle montre le titre, l'icône de statut et la pastille d'espace.
- Jamais proposées : la tâche elle-même, les tâches à la corbeille. Pour la parente, en plus : les sous-tâches, et rien du tout si la tâche a des sous-tâches (la propriété explique pourquoi). Pour une relation : les tâches déjà reliées par ce type.
- Ouverte sans recherche : les tâches ouvertes du côté, dans l'ordre de la liste, 20 au plus. Avec recherche : statuts ouverts d'abord ; les terminées et annulées sont trouvables par leur titre.
- Clavier complet (flèches, Entrée, Échap), focus rendu au déclencheur. Sur iPhone, le clavier s'ouvre au tap (piège du focus synchrone, `docs/gotchas.md`).

### Registre d'actions (ADR-009)
Toutes les écritures ci-dessus passent par le registre, canaux web et assistant, descriptions en anglais (`messages/en.json`) et schémas zod avec `describe` sur chaque champ, lisibles par un modèle. Messages d'erreur anglais par code (`TASK_ERROR_MESSAGES`) : ce qui est refusé et quoi faire.

| Action | Accès | Paramètres | Effet |
| --- | --- | --- | --- |
| `tasks.move` | write | `taskId`, `statusCategory`, `beforeId?`, `afterId?` | Statut et place dans la colonne ; renvoie le détail. |
| `tasks.setParent` | write | `taskId`, `parentId` (uuid ou `null`) | Rattache, change de parente ou détache. |
| `tasks.addRelation` | write | `taskId`, `kind` (`blocks`, `blocked_by`, `related`), `otherTaskId` | Crée la relation, idempotent. |
| `tasks.removeRelation` | write | mêmes paramètres | Retire la relation ; absente → `not_found`. |
| `tasks.listBoard` | read | `side?`, `contextId?`, `completedLimit?` | Colonnes du tableau : cartes ordonnées, totaux, compteur des annulées. |
| `tasks.list` (existante) | read | + `topLevelOnly?` | Sert les listes de sélection (avec `query`). |
| `tasks.get` (existante) | read | inchangés | Le détail gagne `relations` et `blocked`. |

Nouveaux codes : `has_subtasks`, `relation_conflict`. `Task` gagne `blocked` et `sortKey` n'est jamais exposé hors du module (l'ordre est celui du tableau renvoyé).

## Critères d'acceptation

Tableau
- [ ] Le sélecteur Liste / Tableau de `/tasks` change la vue ; le choix est gardé d'une visite à l'autre et d'un appareil à l'autre non (cookie).
- [ ] Le tableau montre cinq colonnes dans l'ordre, limitées au côté actif et à l'espace filtré ; aucune sous-tâche n'est une carte ; aucune tâche à la corbeille n'apparaît.
- [ ] Sous 768 px : une colonne à la fois avec onglets, un onglet est une cible de dépôt ; au-delà : colonnes côte à côte à défilement horizontal, sans aimant.
- [ ] Glisser une carte de « À faire » vers « En cours » change son statut ; au rechargement elle y est, à la place du dépôt.
- [ ] Réordonner trois cartes d'une colonne ouverte, recharger : l'ordre est gardé. Le même ordre relatif est gardé en changeant de filtre d'espace.
- [ ] Déposer dans Terminée pose la date de clôture, la carte arrive en tête ; déposer sur Annulée l'annule et incrémente le compteur ; la sortir de Terminée vide la date de clôture.
- [ ] Terminée affiche 20 cartes et « Tout voir (n) » au-delà ; « Tout voir » les affiche toutes.
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
- [ ] L'empreinte d'une carte saisie se distingue de la colonne : fond et pointillé à 3:1 au moins contre la colonne pour le pointillé.
- [ ] La liste `/tasks` suit la même règle : lignes claires et bordées sur un fond teinté ; le givre de chargement garde ses hauteurs au pixel près.

Détail
- [ ] Ordre : titre ; propriétés (Statut, Priorité, Échéance, Côté et espace, Tags, Tâche parente) ; sous-tâches ; relations ; notes ; corbeille. Une sous-tâche n'a pas de bloc sous-tâches.
- [ ] Le titre se modifie d'un tap ou d'un clic dessus, sans bouton ; au repos il se lit comme un titre avec un repère d'édition visible sans survol ; au focus il devient un champ net ; Entrée ou la sortie du champ enregistre ; vide → erreur, valeur d'avant gardée.
- [ ] Chaque niveau de priorité a sa teinte pastel et son icône, partout où une priorité s'affiche (pastille du détail, menu, carte, ligne, tuile) ; « Aucune » n'a ni teinte ni icône propre. Texte et icône ≥ 4,5:1 sur la teinte ; teintes distinctes des pastilles d'espace et de la braise.
- [ ] « Tâche parente » : choisir une tâche rattache, le côté et l'espace suivent ; « Détacher » la rend de premier niveau ; une tâche qui a des sous-tâches voit la propriété désactivée avec la raison ; une sous-tâche n'est jamais proposée comme parente.
- [ ] « Relations » : choisir un type puis une tâche crée la relation ; elle apparaît aussi, inversée, dans le détail de l'autre tâche ; « Retirer » l'enlève des deux côtés.
- [ ] Les listes de sélection filtrent par titre, ne montrent ni la tâche elle-même ni la corbeille, et s'utilisent au clavier.
- [ ] Notes : une ligne quand elles sont vides, le champ s'agrandit au tap et le reste jusqu'à la fermeture.
- [ ] Ligne « Ajouter une sous-tâche » toujours visible, Entrée valide, prête pour la suivante.

Données et registre
- [ ] `tasks.setParent` refuse : parente sous-tâche, tâche avec sous-tâches actives, elle-même, parente à la corbeille, parente d'un autre workspace (`not_found`).
- [ ] `tasks.addRelation` refuse : elle-même, tâche à la corbeille ou d'un autre workspace (`not_found`), inverse direct d'un blocage (`relation_conflict`) ; un doublon ne crée rien.
- [ ] Isolation : depuis le workspace B, aucune lecture ni écriture d'une relation, d'une parente ou d'un ordre du workspace A, au niveau de la base (connexion `app_backend`).
- [ ] Les nouvelles actions figurent dans les définitions d'outils (`toToolDefinitions`) avec description et schéma JSON complets ; chaque champ est décrit.
- [ ] Migrations additives : l'ancien code tourne sur le nouveau schéma (colonnes nullables, table nouvelle, droits ajoutés).

Retrait de la démo
- [ ] `/demo/kanban`, ses messages, ses fixtures et ses e2e sont supprimés ; `pnpm test:build` refuse toute démo.

## Scénarios utilisateur (joués par /qa)
1. **Faire avancer une tâche** — Antoine ouvre `/tasks`, passe en Tableau, glisse une carte de « À faire » à « En cours », recharge : elle y est. Variante mobile : oui (appui long, dépôt sur l'onglet).
2. **Ranger une colonne** — il réordonne trois cartes de « À faire », change de filtre d'espace puis revient : l'ordre est gardé. Variante mobile : oui.
3. **Terminer et annuler** — il dépose une carte dans Terminée (elle passe en tête), une autre sur Annulée (compteur +1), puis retrouve l'annulée dans la liste avec « Terminées ». Variante mobile : oui.
4. **Échec d'enregistrement** — réseau coupé, il dépose une carte : elle revient, le message s'affiche ; réseau rétabli, Réessayer la déplace. Variante mobile : non.
5. **Clavier** — sans souris : Tab jusqu'à une carte, Espace, flèche droite, Espace ; puis Entrée ouvre le détail, Échap le ferme. Variante mobile : non.
6. **Renommer d'un tap** — depuis le tableau, il ouvre une carte, tape sur le titre, le change, Entrée : la carte porte le nouveau titre. Variante mobile : oui.
7. **Transformer en sous-tâche** — dans le détail d'une tâche Pro sans espace, il choisit comme parente une tâche de l'espace Nexxia : la tâche quitte le tableau, apparaît dans les sous-tâches de la parente avec l'espace Nexxia ; « Détacher » la ramène au tableau. Variante mobile : oui.
8. **Bloquer** — il ajoute « Bloquée par » vers une autre tâche : la carte porte « Bloquée » ; il termine la bloquante : la pastille disparaît. Variante mobile : oui.
9. **Corbeille** — il met une tâche reliée à la corbeille : elle disparaît des relations et des listes de sélection ; restaurée, la relation revient. Variante mobile : non.
10. **Langue** — en anglais, colonnes, types de relation, messages d'erreur et annonces sont traduits. Variante mobile : non.

## Données et sécurité
- Tables touchées : `tasks` — nouvelle colonne `sort_key text COLLATE "C"` nullable ; index partiel `(workspace_id, status_category, sort_key)` sur les tâches actives ; droits `app_backend` : INSERT et UPDATE sur `sort_key`, UPDATE sur `parent_id` (jusqu'ici jamais modifiable, `drizzle/0006_tasks.sql`).
- Nouvelle table `task_relations` : `id`, `workspace_id NOT NULL`, `from_task_id`, `to_task_id` (FK composites `(workspace_id, …)` → `tasks(workspace_id, id)`), `kind text CHECK (kind IN ('blocks','related'))`, `created_at`, `updated_at` ; CHECK `from_task_id <> to_task_id` ; CHECK `kind <> 'related' OR from_task_id < to_task_id` ; unique `(workspace_id, from_task_id, to_task_id, kind)` ; index `(workspace_id, to_task_id)`.
- RLS : activée dans la migration de création ; policies SELECT, INSERT, DELETE par appartenance au workspace (`app.is_workspace_member`) ; pas d'UPDATE (une relation s'ajoute ou se retire) ; droits `app_backend` SELECT, INSERT (colonnes utiles), DELETE.
- Deux migrations additives (0008 ordre et droits, 0009 relations), appliquées en production par la CI (ADR-010).
- Lectures dans `src/modules/tasks/queries.ts` seulement (ADR-004) : tableau, relations du détail, « bloquée », candidates. Toutes partent du prédicat `isActive`, y compris pour l'autre bout d'une relation.
- Écritures dans `mutations.ts`, tâche et voisines verrouillées (`lockTask`) ; parente et famille en une instruction.
- Le `workspaceId` vient de la session ; aucun identifiant de workspace dans un paramètre d'action.
- Aucune donnée métier dans un message d'erreur ou de console (`.claude/rules/sentry.md`).
- Argent / paiement concerné : non. `security-auditor` obligatoire sur les migrations, les mutations et les actions (tâches `[security]` du plan).

## UI
- Écrans concernés : `/tasks` (en-tête avec sélecteur de vue, vue Tableau, vue Liste pour le contraste des lignes), détail d'une tâche (`TaskDetail`), tuiles To-do du tableau de bord (teinte de priorité seulement). Maquette : la démo `/demo/kanban` validée, variante Creux et détail Nouveau.
- Curseurs nexxia-design : VARIANCE 3 · MOTION 4 · DENSITY 6.
- Composants repris tels quels : `SortableBoard` (capteurs, délai, soulèvement, annonces), `TaskDetailSheet`, `SubtaskAddField`, `TaskNotesField`, `ChoiceChip`, `TaskLegendItems`, `status-icons.ts`.
- Surfaces (Creux) : colonne `bg-pill-track` sans verre ni ombre, en-tête à l'encre ; carte `bg-popover border-border shadow-raised` ; calque du glisser `shadow-glass` ; jamais deux verres empilés ; la barre d'onglets mobile reste en verre.
- Survol et empreinte renforcés, tokens existants seulement : survol = contour `input` + `shadow-glass` ; empreinte = fond plus clair que la colonne et pointillé `input` plus épais. Valeurs exactes fixées par la tâche de design, mesures à l'appui.
- Titre éditable : style de titre (`font-heading text-title`), libellé accessible sans libellé visible, repère d'édition (icône crayon 16 px, encre secondaire) visible au repos ; survol `bg-pill-track` ; focus = champ `border-input bg-row` et anneau.
- Priorités en pastel : quatre nouveaux tokens de DESIGN.md § 2 (fond et texte par niveau : urgente, haute, moyenne, basse), déclarés dans `globals.css`, même clarté et même saturation que les pastilles d'espace, teintes choisies hors de celles des espaces et de la braise. L'icône reste : jamais la couleur seule. DESIGN.md amendé (frontmatter, § 2, § 5), la règle « icônes de priorité toujours à l'encre » de `priority-icons.ts` devient « encre du token de la teinte ».
- Tâche parente : ligne de propriété, pastille qui ouvre la liste de sélection ; valeur = titre de la parente (lien) et « Détacher ». Une seule mention de la parente dans le détail : le lien du haut d'une sous-tâche disparaît, « Comme la tâche parente » rejoint cette ligne.
- Constats de `/impeccable critique` du 2026-11-25 (24/40, aucun P0) intégrés : survol et empreinte, cible de dépôt mobile, parente mentionnée une fois, titre, priorité lisible sur la carte.
- Relations : section sous les sous-tâches, même titre de section ; groupes « Bloque », « Bloquée par », « Liée à » ; ligne d'ajout « + Ajouter une relation » (type, puis tâche), sur le modèle de la ligne d'ajout de sous-tâche.
- Liste de sélection : `Autocomplete` de Base UI (déjà utilisé par la palette), popup opaque `popover rounded-lg shadow-glass`, items `min-h-11`.
- Sélecteur de vue : pilule à deux segments du modèle « bascule Privé / Pro » (DESIGN.md § 5), icônes Lucide et libellés.
- Animation : Motion (ADR-006), ressort sans rebond de DESIGN.md § 7 ; `prefers-reduced-motion` respecté.
- Textes : FR et EN, aucun texte en dur (ADR-007). Mobile d'abord, 390 px, zones ≥ 44 px, champs ≥ 16 px (ADR-008).
- Exceptions à la charte gardées (décision du 2026-11-25) : ligne d'ajout de sous-tâche sans libellé visible ; libellé « Notes » en semi-gras ; notes repliées à 46 px ; ombre de saisie `shadow-glass`. À inscrire dans DESIGN.md.
- Avant livraison : anti-slop (`nexxia-design`) puis `/impeccable critique`.

## Questions ouvertes
- [ ] Sous-tâches absentes du tableau (la parente porte le compteur) : confirmé ? Avis : oui, sinon le tableau double de volume. — avant la tâche de lecture du tableau.
- [ ] Liste de sélection limitée au côté de la tâche ouverte, alors que le registre accepte une parente ou une relation de l'autre côté : confirmé ? Avis : oui. — avant la tâche de la liste de sélection.
- [ ] Quatre teintes de priorité : proposées par la tâche de design, validées à l'œil sur la preview avant d'être appliquées partout.
- [ ] Vue par défaut : Liste. Tableau par défaut sur ordinateur ? Avis : non, un seul défaut.
