# Spec — To-do unifiée (tranche 1)

**Créée le** : 2026-11-19 · **Statut** : validée (Antoine, 2026-11-19) · **Plan** : `plan.md`

## Objectif
Antoine note une tâche en une seconde depuis n'importe quel écran, sans syntaxe (`#projet`, `@tag`), puis la retrouve dans une seule liste filtrée par côté (Privé / Pro) et par espace, avec ce qui tombe aujourd'hui visible sur le tableau de bord.

Références : Linear pour le modèle (catégories de statut, priorité, sous-tâches, relations), Monday pour la facilité de saisie.

## Livraison en tranches (une feature chacune)
1. **Cette feature** : tâches, statut, priorité, tags, échéance (avec ou sans heure), espace, sous-tâches, corbeille, vue liste, ajout rapide (bouton central mobile + palette via le registre d'actions), tuiles « Aujourd'hui », « To-do privée », « To-do pro ».
2. Vue kanban par statut, relations entre tâches (bloque, bloquée par, liée à).

Le calendrier iOS n'est pas une tranche de la to-do : c'est un module calendrier à part (lecture et écriture via le compte derrière le calendrier), qui fait foi pour les rendez-vous (décision du 2026-11-19, `docs/roadmap.md`).

## Hors périmètre
- Import depuis `todo-perso-pro` : on part de zéro.
- Kanban, ordre manuel, relations entre tâches : tranche 2.
- Calendrier, rappels, notifications : module calendrier à part.
- Lien GitHub et toute synchro de dépôt : BRAIN-21.
- Création par WhatsApp ou Slack, dictée intelligente, connecteur Claude : BRAIN-27, BRAIN-25, BRAIN-38. Aucun appel à un modèle dans cette feature ; les actions sont seulement prêtes à servir d'outils.
- Assignation à un membre (attend l'espace partagé, BRAIN-32).
- Vidage de la corbeille, suppression définitive, purge automatique.
- Gestion des tags (renommer, supprimer, fusionner) : les tags se créent à la volée.
- Tâches récurrentes. Sous-tâches sur plus d'un niveau.

## Modèle de données complet

Toutes les tables suivent `.claude/rules/neon.md` : `id uuid`, `workspace_id NOT NULL`, `created_at`, `updated_at` (trigger `app.set_updated_at`), RLS dans la même migration, une policy par verbe (`app.is_workspace_member`), GRANT par colonne, enums en `text` + CHECK.
Chaque FK vers une autre ligne métier est **composite avec `workspace_id`** : la base refuse qu'une tâche pointe vers un espace, un tag, une tâche parente ou une tâche liée d'un autre workspace, quelle que soit la RLS.

### `tasks` — tranche 1
| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | uuid | PK |
| `workspace_id` | uuid NOT NULL | FK `workspaces` |
| `side` | text NOT NULL | CHECK `('private','pro')`. Toujours renseigné, même sans espace. |
| `context_id` | uuid NULL | FK composite `(workspace_id, context_id, side)` → `contexts(workspace_id, id, kind)`, `ON UPDATE CASCADE`, `ON DELETE SET NULL (context_id)` |
| `parent_id` | uuid NULL | FK composite `(workspace_id, parent_id, side)` → `tasks(workspace_id, id, side)` : une sous-tâche a toujours le côté de sa parente (voir « Sous-tâches ») |
| `title` | text NOT NULL | CHECK longueur 1 à 500 après trim |
| `notes` | text NULL | CHECK longueur ≤ 10 000 |
| `status_category` | text NOT NULL default `'unstarted'` | CHECK `('backlog','unstarted','started','completed','canceled')`. Voir « Statuts » ci-dessous. |
| `priority` | smallint NOT NULL default 0 | CHECK 0 à 4 (0 aucune, 1 urgente, 2 haute, 3 moyenne, 4 basse, ordre Linear) |
| `due_date` | date NULL | Date locale |
| `due_time` | time NULL | Heure locale ; CHECK `due_time IS NULL OR due_date IS NOT NULL` |
| `completed_at` | timestamptz NULL | Posé par la mutation au passage à `completed` ou `canceled`, vidé au retour vers une autre catégorie |
| `origin` | text NOT NULL | CHECK `('app','palette','assistant','whatsapp','slack')`. Posée par le point d'entrée serveur de l'action (voir « Registre d'actions »), jamais par un paramètre. GRANT INSERT seulement, jamais UPDATE. |
| `deleted_at` | timestamptz NULL | Corbeille. Voir « Corbeille ». |
| `created_by` | uuid NOT NULL | Utilisateur créateur, posé par la base (`default app.current_user_id()`), hors GRANT de l'app |
| `created_at`, `updated_at` | timestamptz | |

Index (partiels `WHERE deleted_at IS NULL` sauf mention) : `(workspace_id, side, status_category)`, `(workspace_id, due_date)`, `(workspace_id, context_id)`, `(workspace_id, parent_id)` ; et `(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL` pour la corbeille.
Unique `(workspace_id, id)` et `(workspace_id, id, side)` : cibles des FK composites.
Côté `contexts` (additif) : unique `(workspace_id, id, kind)`, cible de la FK de `tasks`.

Couleur des espaces (migration 0007, additive, décision d'Antoine du 2026-11-19) : `contexts.color text NOT NULL DEFAULT 'neutral' CHECK (color IN ('neutral','warm','indigo'))`, les trois pastilles de DESIGN.md (`chip-neutral`, `chip-warm`, `chip-indigo`). Valeurs posées pour les espaces existants : Privé `neutral`, Trustup `warm`, Nexxia `indigo` (seed et migration). Aucun écran pour la changer : BRAIN-30.

**Statuts.** La colonne porte une catégorie au sens de Linear, pas un statut. Les cinq catégories sont figées : tout le code (tuiles, filtres, `completed_at`, kanban) raisonne sur elles. Des statuts personnalisés viendront plus tard par migration additive : table `task_statuses (id, workspace_id, name, category, position)` et colonne `tasks.status_id` nullable, FK composite `(workspace_id, status_id, status_category)` → `task_statuses(workspace_id, id, category)`. La catégorie de la tâche reste ainsi toujours celle de son statut, et une tâche sans statut personnalisé garde le statut par défaut de sa catégorie. Libellés par défaut de l'interface : Backlog, À faire, En cours, Fait, Annulé.

**Corbeille.** Aucune suppression définitive : `app_backend` n'a pas le droit DELETE sur `tasks` (pas de GRANT, pas de policy DELETE). Mettre une tâche à la corbeille = `deleted_at = now()`, la restaurer = `deleted_at = NULL`.
- Sous-tâches : la mise à la corbeille d'une parente pose **le même horodatage** sur ses sous-tâches encore actives. La restauration de la parente restaure les sous-tâches qui portent cet horodatage, et seulement elles : une sous-tâche mise à la corbeille seule avant sa parente y reste. Une sous-tâche dont la parente est à la corbeille ne se restaure pas seule (erreur `parent_in_trash`).
- RLS : elle ne filtre que l'appartenance au workspace, pas la corbeille. Filtrer `deleted_at` dans la policy SELECT ferait échouer la mise à la corbeille elle-même (Postgres exige que la ligne modifiée reste visible) et rendrait la corbeille illisible. La RLS isole les workspaces ; la corbeille est une règle de lecture.
- Lectures : `src/modules/tasks/queries.ts` est le seul accès (ADR-002). Toutes ses fonctions partent d'un seul prédicat `isActive` (`deleted_at IS NULL`) ; seule `listTrashedTasks` lit `deleted_at IS NOT NULL`. Les écritures (`mutations.ts`) ne touchent qu'une tâche active, sauf `restoreTask` ; une tâche à la corbeille est `not_found` pour elles. Les tags d'une tâche à la corbeille ne comptent nulle part.
- Verrou par test : chaque test de lecture place une tâche à la corbeille dans sa fixture et vérifie qu'elle n'apparaît pas.

**Sous-tâches.** Une sous-tâche hérite du côté et de l'espace de sa parente à la création et les suit quand la parente en change.
- Côté : garanti **en base** par la FK `(workspace_id, parent_id, side)`. Le changement de côté d'une parente et de ses sous-tâches se fait en une seule instruction `UPDATE … WHERE id = $1 OR parent_id = $1` : la FK (NO ACTION) est vérifiée en fin d'instruction, donc sur l'état cohérent.
- Espace : garanti **dans `mutations.ts`**, dans la même instruction. La base ne peut pas l'imposer par FK : `context_id` est nullable, et une FK composite ne vérifie rien dès qu'une colonne est NULL (MATCH SIMPLE) ; MATCH FULL refuserait une parente sans espace. Un trigger le pourrait, au prix d'une fonction SECURITY DEFINER de plus ; non retenu. Verrou : test de mutation + test d'isolation qui tente l'écart en SQL direct et documente qu'il passe (limite assumée).
- `tasks.update` sur une sous-tâche refuse `side` et `context` (`subtask_follows_parent`). `ON DELETE SET NULL` d'un espace vide `context_id` de la parente et des sous-tâches ensemble.
- Cocher une parente ne touche pas ses sous-tâches : pas de fermeture en cascade. Le compteur reste visible.

### `tags` — tranche 1
| Colonne | Type | Règle |
| --- | --- | --- |
| `id`, `workspace_id`, `created_at`, `updated_at` | | standard |
| `name` | text NOT NULL | CHECK longueur 1 à 50 après trim ; unique `(workspace_id, lower(name))` |

Tags communs aux deux côtés. Pas de couleur (colonne additive plus tard). Pas de DELETE en tranche 1 (aucun GRANT).

### `task_tags` — tranche 1
| Colonne | Type | Règle |
| --- | --- | --- |
| `workspace_id` | uuid NOT NULL | |
| `task_id` | uuid NOT NULL | FK composite → `tasks(workspace_id, id)` |
| `tag_id` | uuid NOT NULL | FK composite → `tags(workspace_id, id)` |
| `created_at` | timestamptz | |

PK `(workspace_id, task_id, tag_id)` ; index `(workspace_id, tag_id)`. `workspace_id` est dans la clé pour qu'un membre de B ne puisse pas savoir si un lien existe chez A : sans lui, insérer `(B, tâche de A, tag de A)` renvoyait un doublon si le lien existait, une erreur de FK sinon (décision du 2026-11-19). DELETE autorisé (retirer un tag d'une tâche) ; pas d'UPDATE : un lien ne se modifie pas, il s'ajoute ou se retire.

### `task_relations` — tranche 2 (non créée ici)
`id`, `workspace_id`, `from_task_id`, `to_task_id` (FK composites), `kind` CHECK `('blocks','related')`. « Bloquée par » = lecture inverse de `blocks`. CHECK `from_task_id <> to_task_id` ; unique `(from_task_id, to_task_id, kind)` ; `related` stocké une fois (plus petit id en `from`). Une relation vers une tâche à la corbeille est masquée à la lecture, pas supprimée.

### `task_links` — BRAIN-21 (non créée ici)
`id`, `workspace_id`, `task_id`, `kind` CHECK `('url','github_repo','github_issue')`, `url`, `label`. Plusieurs liens par tâche.

### Ajouts prévus (additifs)
- Tranche 2 : `tasks.sort_key text` (ordre manuel dans une colonne du kanban, index fractionnaire).
- Statuts personnalisés : `task_statuses` + `tasks.status_id` (voir « Statuts »).

### Ce que la tranche 1 utilise
Tout `tasks`, `tags`, `task_tags`. `task_relations` et `task_links` ne sont pas créées : une table sans code qui la lit apporterait RLS, droits et tests sans utilisateur, et leur création plus tard est additive.

### Décisions que la tranche 2 pourrait remettre en cause
1. Catégories figées : le kanban affiche une colonne par catégorie. Des colonnes personnalisées passent par les statuts personnalisés ci-dessus, sans toucher `status_category`.
2. Échéance en date + heure locales, sans fuseau (validé). « Aujourd'hui » se calcule dans le fuseau de l'utilisateur, donné par une seule fonction `getUserTimeZone` (`src/modules/core/time-zone.ts`), qui renvoie `Europe/Brussels` en tranche 1 et lira une préférence plus tard. Le socle a déjà une constante `timeZone = "Europe/Brussels"` dans `src/i18n/config.ts` (formatage next-intl) : elle disparaît, `src/i18n/request.ts` appelle `getUserTimeZone`. Aucun autre fichier n'écrit un fuseau (verrou par test : recherche de `Europe/` dans `src/`).
3. Un seul niveau de sous-tâches, contrôlé dans `mutations.ts` : le lever ne demande aucune migration.
4. Côté porté par la tâche et recopié de l'espace par la FK composite (validé).

## Registre d'actions : prêt pour un modèle
Toute écriture de tâche passe par une action du registre (ADR-009), y compris depuis l'écran liste et l'ajout rapide : une Server Action de l'app appelle le registre, jamais `mutations.ts` directement. Premier consommateur IA prévu : connecteur pour l'app Claude (BRAIN-38), puis WhatsApp et Slack.

Actions de la tranche 1 (canaux `web` et `assistant`) :
| Action | Accès | Rôle |
| --- | --- | --- |
| `tasks.list` | read | Tâches actives (sous-tâches comprises, avec `parentId` et `parentTitle`) filtrées par côté, espace, catégories, tag, échéance au plus tard le, texte du titre (`query`, insensible à la casse, 1 à 100 caractères, jokers SQL échappés ; accents : voir plan) ; `limit` 50 par défaut, plafond 200 ; renvoie `truncated: true` quand il y en a plus. Terminées et annulées exclues par défaut |
| `tasks.get` | read | Une tâche avec ses tags et ses sous-tâches actives |
| `tasks.listDueToday` | read | Tâches non terminées en retard ou dues aujourd'hui, des deux côtés |
| `tasks.listTrash` | read | Corbeille |
| `tasks.listTags` | read | Tags du workspace |
| `tasks.create` | write | Crée une tâche ou une sous-tâche (`parentId`) ; `tags` : noms, créés s'ils n'existent pas |
| `tasks.update` | write | Modifie titre, notes, côté, espace, catégorie, priorité, échéance. Tags : `addTags` et `removeTags` (noms), jamais de remplacement de l'ensemble ; retirer un tag absent n'est pas une erreur ; un même nom dans les deux → `invalid_params` |
| `tasks.complete` | write | Raccourci : catégorie `completed` |
| `tasks.moveToTrash` | write | Met une tâche (et ses sous-tâches) à la corbeille |
| `tasks.restore` | write | Restaure une tâche (et ses sous-tâches mises avec elle) |

Exigences pour un usage par un modèle :
- **Noms** `tasks.<verbe>` explicites, un verbe par intention.
- **Description en clair.** Aujourd'hui `description` est une clé de traduction (`actions.core.setLocale`). La définition d'outil prend sa traduction anglaise (`messages/en.json`), rédigée pour un modèle : ce que fait l'action, quand l'utiliser, ce qu'elle renvoie.
- **Schéma d'entrée typé** : `z.strictObject`, chaque champ avec `.describe()` (en anglais, unités et formats : `YYYY-MM-DD`, `HH:MM`, priorité 0 à 4). Le registre expose une fonction `toToolDefinitions(channel)` qui renvoie `{ name, description, inputSchema }` avec `z.toJSONSchema` de zod 4 (déjà installé, aucune dépendance). Test : chaque action de `tasks` produit un JSON Schema valide sans champ `workspaceId`, `userId` ni `origin`.
- **Erreurs lisibles** : chaque refus porte un code stable et un message en anglais qui dit quoi faire (ex. `parent_in_trash` : « The parent task is in the trash. Restore the parent first. »). L'interface traduit le code ; le message n'inclut jamais une donnée d'un autre workspace ni la valeur reçue.
- **Identifiants** : un modèle peut désigner un espace et des tags par leur nom (`context`, `tags`) ; l'action résout le nom dans le workspace de la session, refus `context_not_found` sinon.
- **Origine** : `ActionContext` reçoit `origin`, posé par le point d'entrée serveur (Server Action de l'écran = `app`, palette = `palette`, route assistant = `assistant`) ; ce n'est jamais un paramètre d'action. Touche `src/modules/actions/` : tâche `[security]`.

## Critères d'acceptation
Données et sécurité
- [ ] Une lecture ou une écriture sur `tasks`, `tags` ou `task_tags` d'un autre workspace est refusée par la base (42501 ou zéro ligne), avec la connexion `app_backend`.
- [ ] Un membre de B ne peut pas savoir si un lien tâche–tag existe chez A : la même insertion donne le même refus, lien existant ou non (test « B ne peut plus sonder un lien de A », `tests/db/isolation-tasks.test.ts`).
- [ ] Une tâche qui référence un espace, une parente ou un tag d'un autre workspace est refusée par la base (violation de FK), même en contournant `mutations.ts`.
- [ ] Une tâche dont `side` diffère du `kind` de son espace est refusée par la base.
- [ ] `DELETE FROM tasks` par `app_backend` est refusé (42501).
- [ ] `app_backend` ne peut fixer ni `created_by`, ni `origin` en UPDATE, ni `updated_at`.
- [ ] Supprimer un espace garde ses tâches, du même côté, sans espace. Changer un espace de côté change le côté de ses tâches.
- [ ] Une sous-tâche de sous-tâche est refusée (`subtask_depth`).
- [ ] Une sous-tâche créée sans côté ni espace prend ceux de sa parente ; changer le côté ou l'espace de la parente change ceux de ses sous-tâches (actives et à la corbeille).
- [ ] Une sous-tâche de côté différent de sa parente est refusée par la base (violation de FK, SQL direct).
- [ ] `tasks.update` d'une sous-tâche avec `side` ou `context` renvoie `subtask_follows_parent`.
- [ ] Cocher une parente avec des sous-tâches ouvertes la passe à `completed` ; ses sous-tâches gardent leur catégorie ; le compteur « n/m » reste affiché.

Corbeille
- [ ] Une tâche à la corbeille n'apparaît dans aucune lecture sauf `tasks.listTrash`, ni dans les tuiles.
- [ ] Mettre une parente à la corbeille y met ses sous-tâches actives ; la restaurer les restaure, sauf une sous-tâche mise à la corbeille avant elle.
- [ ] Restaurer une sous-tâche dont la parente est à la corbeille renvoie `parent_in_trash`.
- [ ] Modifier ou terminer une tâche à la corbeille renvoie `not_found`.

Saisie et liste
- [ ] Le « + » central (mobile) et le bouton d'ajout de l'en-tête (ordinateur) ouvrent l'ajout rapide ; la palette reste accessible par l'en-tête sur mobile.
- [ ] L'ajout rapide crée une tâche avec un titre seul ; côté et espace prennent le filtre courant (côté actif, espace sélectionné ou aucun).
- [ ] Espace, tags et date se choisissent chacun en un tap depuis l'ajout rapide, sans syntaxe ; un tag inconnu tapé est créé.
- [ ] Une tâche créée depuis l'écran a `origin = app`, depuis la palette `origin = palette`.
- [ ] La liste n'affiche que le côté actif et l'espace filtré, triée par échéance (sans échéance en dernier), puis heure, puis priorité (aucune en dernier), puis date de création ; terminées et annulées masquées, visibles par un interrupteur.
- [ ] Cocher une tâche la passe à `completed` ; le bouton est désactivé pendant l'appel, pas de mise à jour optimiste. Une erreur s'affiche dans la ligne.
- [ ] Une sous-tâche sans échéance n'est pas une ligne de la liste ; avec une échéance, elle apparaît dans la section de cette échéance et dans la tuile « Aujourd'hui », titre de la parente en légende ; la parente montre « n/m ».
- [ ] Le détail d'une tâche permet de modifier tous les champs de la tranche 1, d'ajouter des sous-tâches et de la mettre à la corbeille.
- [ ] États vide, chargement et erreur présents sur la liste, le détail, la corbeille et les tuiles.
- [ ] Tous les textes existent en FR et en EN ; le contenu saisi n'est jamais traduit.

Tableau de bord
- [ ] Tuile « Aujourd'hui » : nombre de tâches en retard et dues aujourd'hui, et les 3 premières, des deux côtés, avec le côté visible. « Aujourd'hui » vient de `getUserTimeZone`.
- [ ] Passage de minuit : une tâche due le jour J est « aujourd'hui » à 23:30 et à 00:30 heure de Bruxelles le jour J (alors qu'il est encore J−1 ou déjà J+1 en UTC selon le cas), et « en retard » à 00:30 le jour J+1. Test avec horloge figée.
- [ ] Aucun fuseau écrit dans `src/` hors `getUserTimeZone` (test).
- [ ] Tuiles « To-do privée » et « To-do pro » : les 5 prochaines tâches actives du côté, lien vers la liste filtrée sur ce côté.

Registre
- [ ] `toToolDefinitions("assistant")` renvoie les dix actions `tasks.*` avec description en clair et JSON Schema valide, sans `workspaceId`, `userId` ni `origin`.
- [ ] Chaque code d'erreur de `tasks` a un message anglais non vide et une traduction FR/EN d'interface.
- [ ] `tasks.list` avec `query: "devis"` trouve « Relancer le Devis » et pas « Payer la crèche » ; `query: "100%"` ne se comporte pas comme un joker.
- [ ] `tasks.list` avec `limit: 500` est refusé (`invalid_params`) ; avec 3 tâches et `limit: 2`, renvoie 2 tâches et `truncated: true`.
- [ ] `tasks.update` avec `addTags: ["a"]` garde les tags existants et ajoute « a » ; `removeTags: ["b"]` ne retire que « b » ; le schéma n'a pas de champ `tags`.
- [ ] Test d'isolation du registre : une action `tasks.*` appelée avec la session du workspace A ne lit ni n'écrit rien de B.

## Scénarios utilisateur (joués par /qa)
1. **Ajout rapide sur mobile** : Antoine, sur le tableau de bord en 390 px côté Pro, touche le bouton central, tape « Relancer le devis », choisit l'espace Trustup, le tag « client » et demain, valide. Le formulaire se vide pour une tâche suivante ; la tâche apparaît dans la liste Pro filtrée Trustup. Variante mobile : oui (c'est le scénario).
2. **Ajout par la palette** : sur ordinateur, Antoine ouvre la palette (⌘K), tape « Payer la crèche », choisit « Ajouter la tâche « Payer la crèche » ». La tâche apparaît côté actif, espace filtré ou aucun, origine `palette`. Variante mobile : oui (palette ouverte depuis l'en-tête).
3. **Titre seul** : Antoine crée « Acheter des ampoules » sans rien choisir d'autre. La tâche est créée côté actif, catégorie À faire, sans échéance.
4. **Aujourd'hui** : avec une tâche Privé due hier, une tâche Pro due aujourd'hui à 14:00 et une due demain, la tuile « Aujourd'hui » montre les deux premières, côté visible, et pas la troisième. Cocher celle de 14:00 depuis la liste la retire de la tuile.
5. **Sous-tâches et corbeille** : Antoine ajoute deux sous-tâches à une tâche, met une sous-tâche seule à la corbeille, puis la parente. La corbeille montre la parente et la sous-tâche isolée. Il restaure la parente : elle revient avec une sous-tâche, l'autre reste à la corbeille.
6. **Filtres** : Antoine bascule Privé / Pro et choisit un espace : la liste ne montre que les tâches correspondantes ; l'interrupteur « terminées » fait apparaître les tâches cochées.
7. **Langue** : en anglais, l'ajout rapide, la liste, le détail, la corbeille et les tuiles sont entièrement en anglais ; les titres saisis restent tels quels.

## Données et sécurité
- Nouvelles tables : `tasks`, `tags`, `task_tags`. Table modifiée : `contexts` (contrainte unique additive en 0006, colonne `color` en 0007). Migrations additives.
- RLS : SELECT, INSERT, UPDATE sur `tasks` et `tags` ; SELECT, INSERT, DELETE sur `task_tags`, filtre `app.is_workspace_member(workspace_id)`. FK composites contre tout lien entre workspaces. Corbeille filtrée dans `queries.ts`, pas en RLS (voir « Corbeille »).
- Accès : uniquement via `src/modules/tasks/queries.ts` et `mutations.ts`, `workspaceId` de la session.
- Registre modifié (`origin` dans le contexte, `toToolDefinitions`) : `[security]`.
- Argent : non. Module sensible au sens de BRAIN-34 : non.

## UI
Curseurs nexxia-design : VARIANCE 3 · MOTION 4 · DENSITY 6 (outil quotidien, lu vite, saisi vite). Mobile d'abord, 390 px (ADR-008). Composants et tokens de DESIGN.md uniquement ; aucune couleur ni police nouvelle.

### Ajout rapide (`src/components/quick-add/`)
- **Geste unique, plusieurs types.** Le « + » central (mobile) et le bouton d'ajout rond de l'en-tête (ordinateur, retiré le 2026-11-16 « jusqu'à la première action d'ajout d'un module », il revient ici) ouvrent le même composant `QuickAdd`. Il lit une liste de types déclarés (`quick-add-types.ts` : clé, libellé, icône, formulaire, action du registre). Tranche 1 : un seul type, `task`. Avec un seul type, aucun sélecteur n'est affiché ; à partir de deux (dépense, article de courses), une pilule de types apparaît en haut, comme la bascule Privé / Pro, sans changer le geste. Le dernier type utilisé est retenu pour la session.
- **Contenant** : tiroir bas sur mobile (verre opaque `popover`, `rounded-tile` en haut, poignée, ressort `bounce: 0.2`, 0,3 s), dialogue centré sur ordinateur (même entrée que la palette). Clavier ouvert d'office, focus dans le titre.
- **Formulaire tâche** : champ titre (libellé visible « Tâche », `text-base`, ≥ 44 px), puis une rangée de pastilles d'un tap, toutes facultatives :
  - **Espace** : pré-rempli avec le filtre courant ; menu « Aucun » + espaces du côté actif, couleur de pastille de l'espace. Le côté suit la bascule Privé / Pro de la coque.
  - **Date** : Aujourd'hui, Demain, Ce week-end, Semaine prochaine, Choisir… (calendrier), puis « Ajouter une heure » facultatif. Ce week-end = aujourd'hui le samedi et le dimanche, sinon le samedi qui suit ; Semaine prochaine = le lundi qui suit.
  - **Tags** : liste filtrée en tapant ; « Créer « … » » si le nom n'existe pas. Plusieurs tags.
  - Priorité et notes ne sont pas dans l'ajout rapide : dans le détail.
- **Valider** : Entrée ou bouton « Ajouter » (désactivé tant que le titre est vide et pendant l'appel). Succès : titre vidé, date et tags vidés, espace gardé, focus rendu au titre, message court « Tâche ajoutée » avec lien « Ouvrir » (`role="status"`, `data-testid="quick-add-status"`). Échec : message dans le tiroir, saisie conservée.
- Origine : la Server Action de l'ajout rapide pose `app`.

### Palette
- Saisie libre → élément « Ajouter la tâche « … » » : premier quand aucune commande ne correspond à la saisie, sinon après la dernière commande correspondante (Entrée lance la commande trouvée : « corb » → Corbeille). Il appelle `tasks.create` (origine `palette`), avec le côté et l'espace courants. Commandes : « Nouvelle tâche » (ouvre l'ajout rapide), « Ouvrir la to-do », « Corbeille ».
- Le type `action` de `commands.ts` est aujourd'hui un littéral `"core.setLocale"` : il s'élargit aux noms d'actions du registre.

### Liste (`/tasks`)
- Entrée « To-do » dans la navigation (`nav-items.ts`), avant Réglages ; onglet mobile à gauche du « + ».
- En-tête de page : titre « To-do », filtre d'espace (existant), interrupteur « Terminées ». La bascule Privé / Pro de la coque filtre le côté.
- Sections par échéance : En retard, Aujourd'hui, Demain, Plus tard, Sans échéance ; dans chaque section, échéance, puis heure, puis priorité (aucune en dernier), puis date de création (« Sans échéance » : priorité puis date de création). Même ordre que la lecture en base.
- Sous-tâches : pas de ligne de premier niveau, seulement le compteur « n/m » sur la parente. Exception : une sous-tâche qui a sa propre échéance apparaît aussi dans la section de son échéance (jamais dans « Sans échéance ») et dans la tuile « Aujourd'hui », avec le titre de la parente en légende. Règle portée par une fonction pure de `src/modules/tasks/` (testée), pas par le composant. Terminées (si affichées) en dernière section, par `completed_at` décroissant.
- Ligne (`row rounded-lg min-h-11 px-3.5`) : case à cocher (zone 44 px, `label` sur la case seule), titre (`text-body`, deux lignes max), puis en `text-caption` : pastille d'espace, échéance (`text-destructive` si en retard), heure, tags, icône de priorité (aucune icône pour 0), compteur de sous-tâches « 1/3 ». Tap sur le reste de la ligne → détail.
- Cocher : case désactivée pendant l'appel, ligne qui sort en `opacity` + `y` 8 (Motion) après succès ; pas de mise à jour optimiste ; erreur dans la ligne.
- Vide : phrase + bouton « Ajouter une tâche » qui ouvre l'ajout rapide. Vide filtré : « Rien dans cet espace » + lien « Voir tous les espaces ». Chargement : squelettes de lignes. Erreur : `error.tsx` avec `retry()`.

### Détail (`/tasks/[id]`)
- Tiroir sur mobile, panneau latéral sur ordinateur, au-dessus de la liste ; URL propre pour le lien profond.
- Titre modifiable, notes (zone de texte), puis lignes de champs : Statut (5 catégories, libellés par défaut), Priorité, Côté et espace, Échéance (date, heure), Tags. Chaque modification appelle `tasks.update` ; le champ est désactivé pendant l'appel, erreur sous le champ.
- Sous-tâches : liste de lignes cochables + champ « Ajouter une sous-tâche » (Entrée). Pas de sous-tâche dans une sous-tâche : le champ n'existe pas sur le détail d'une sous-tâche, qui affiche sa parente en lien.
- Pied : « Mettre à la corbeille » (bouton secondaire, pas de confirmation, message « Mise à la corbeille » + « Annuler » qui restaure).

### Corbeille (`/trash`)
- Corbeille de toute l'app (décision d'Antoine, 2026-11-19) : les tâches en sont le premier type. Chaque module y déclare son type (lecture des éléments à la corbeille, ligne, restauration), comme l'ajout rapide déclare ses formulaires ; aucun autre type en tranche 1. Hors de `/tasks/…`, pour que le détail `/tasks/[id]` s'ouvre par-dessus la liste sans squelette.
- Accès : lien en bas de la liste et commande de palette, tous deux vers `/trash`. Lignes non cochables, date de mise à la corbeille, bouton « Restaurer » par ligne. Une parente montre « + n sous-tâches ». Vide : « La corbeille est vide ».

### Tableau de bord
- Tuile « Aujourd'hui » (pleine, DESIGN.md § 5) : pastilles de chiffres « En retard » et « Aujourd'hui », puis les 3 premières tâches (voir Questions ouvertes), lien « Tout voir ».
- Tuiles « To-do privée » et « To-do pro » (verre, existantes, aujourd'hui vides) : 5 prochaines tâches actives du côté, case à cocher comprise, lien « Tout voir » vers `/tasks` sur ce côté.

### Mouvement
Interactions Motion de DESIGN.md § 7 seulement (pression, apparition et retrait de ligne, tiroir). Pas de moment signature dans cette tranche.

### Avant livraison
Anti-slop (`nexxia-design`) puis `/impeccable critique` sur la liste, l'ajout rapide et le détail.

## Questions ouvertes
- [x] Bouton central mobile → ajout rapide, palette dans l'en-tête sur mobile (Antoine, 2026-11-19).
- [x] Fuseau : `Europe/Brussels` en tranche 1 via la seule fonction `getUserTimeZone` (Antoine, 2026-11-19).
- [x] Tuile « Aujourd'hui » avec les 3 premières tâches : validé, DESIGN.md § 5 mis à jour (Antoine, 2026-11-19).
- [x] Effets de verre animés (BRAIN-33) : à part, après cette feature (Antoine, 2026-11-19).
- [x] Sous-tâches dans la liste : compteur sur la parente, ligne propre seulement quand elles ont une échéance (Antoine, 2026-11-19).
