# Plan — To-do unifiée (tranche 1)

**Spec** : `spec.md` (validée le 2026-11-19) · **Branche** : `feat/todo-unifiee` · **Créé le** : 2026-11-19

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = security-auditor passe après le reviewer. -->

## Décisions prises dans ce plan
- **Une seule migration** `drizzle/0006_tasks.sql` : générée par `pnpm db:generate`, complétée à la main pour ce que Drizzle n'exprime pas (`ON DELETE SET NULL (context_id)`, triggers `updated_at`, GRANT par colonne, REVOKE DELETE). Ordre : contrainte unique de `contexts`, tables, contraintes, policies, triggers, GRANT. Additive uniquement (BRAIN-37) : l'ancien déploiement l'ignore.
- **Vérification de l'ordre de la migration** : appliquée sur la branche Neon `test`, puis par la CI sur la preview, puis par « Migrer la production » au merge.
- **Point d'entrée de l'origine** : `ActionContext.origin` est posé par l'appelant serveur. `runActionWithToken` prend l'origine en argument interne (jamais du client) ; la Server Action de la palette passe `palette`, celles de l'écran `app`. Le canal `assistant` n'a pas encore de route : `assistant` est seulement déclaré.
- **Messages d'erreur pour un modèle** : `TaskError` porte un code ; une table `TASK_ERROR_MESSAGES` (anglais, en code, pas dans `messages/` : ce n'est pas de l'interface) donne le texte lisible ; l'interface traduit le code via `messages/*.json`.
- **Description des actions pour un modèle** : traduction anglaise de la clé `description` (`messages/en.json`, section `actions`), lue directement dans le JSON par `toToolDefinitions` (next-intl tire React, exclu du registre par ADR-009) ; égalité avec `createTranslator` vérifiée par test.
- **Recherche par texte** : `ILIKE` avec échappement de `%`, `_` et `\`, sans `unaccent` ni `pg_trgm` (aucune extension ajoutée ; volume personnel). « Sans accents exigés » de la spec : la recherche est insensible à la casse ; l'insensibilité aux accents est reportée (question en bas).
- **Raccourcis de date** de l'ajout rapide : Aujourd'hui, Demain, Ce week-end = aujourd'hui le samedi et le dimanche, sinon le samedi qui suit (décision d'Antoine, 2026-11-19), Semaine prochaine = lundi suivant. Calculés par une fonction pure de `src/modules/tasks/` à partir de `getUserTimeZone`.
- **Primitives** : tiroir et menus avec Base UI (déjà installé, `Dialog`, `Menu`, `Popover`) ; calendrier de « Choisir… » : `<input type="date">` et `<input type="time">` natifs (iOS les rend en roues), aucune bibliothèque de calendrier.

## Dépendances nouvelles (justification, constitution 7)
- Aucune.

## Tâches
- [x] **1. Fuseau de l'utilisateur en une seule fonction**
  - Fichiers : `src/modules/core/time-zone.ts` (`getUserTimeZone()`, `todayIn(timeZone, now)` → `YYYY-MM-DD`), `src/i18n/config.ts` (constante retirée), `src/i18n/request.ts`, tests qui importaient `timeZone` (`src/i18n/format.test.ts`, `src/app/(app)/dashboard/page.test.tsx`)
  - Test à écrire d'abord : `src/modules/core/time-zone.test.ts` — « 23:30 et 00:30 heure de Bruxelles, en hiver et en été, donnent le bon jour » ; `tests/i18n/time-zone-single-source.test.ts` — « aucun `Europe/` dans `src/` hors time-zone.ts »
  - Fini quand : tests verts, formatage next-intl inchangé, `pnpm typecheck` vert

- [x] **2. Schéma et migration `tasks`, `tags`, `task_tags`** [security]
  - Fichiers : `src/db/schema/tasks.ts`, `src/db/schema/core.ts` (unique `(workspace_id, id, kind)`), `drizzle/0006_tasks.sql` + `drizzle/meta/`
  - Test à écrire d'abord : `tests/db/schema-tasks.test.ts` (branche `test`, connexion `app_backend`) — CHECK (catégorie, priorité, titre vide, heure sans date), FK composites (espace, parente, tag d'un autre workspace refusés ; sous-tâche de côté différent refusée ; tâche de côté différent de son espace refusée), `DELETE FROM tasks` refusé (42501), `created_by` posé par la base, `origin` non modifiable, `updated_at` tenu par le trigger, suppression d'un espace → `context_id` NULL et côté gardé, changement de `kind` d'un espace → côté des tâches suivi
  - Fini quand : migration appliquée sur `test`, RLS + une policy par verbe (pas de DELETE sur `tasks` ni `tags`), tests verts

- [x] **3. Test d'isolation de la base pour `tasks`** [security]
  - Fichiers : `tests/factories/tasks.ts` (fixture : tâches, sous-tâches, tags, tâche à la corbeille, dans deux workspaces), `tests/factories/core.ts` (nettoyage : `task_tags`, `tasks`, `tags` avant les workspaces, en propriétaire)
  - Test à écrire d'abord : `tests/db/isolation-tasks.test.ts` — « l'utilisateur de B ne lit, n'insère, ne modifie rien de A sur les trois tables » ; « écart d'espace entre parente et sous-tâche en SQL direct : accepté par la base, limite documentée »
  - Fini quand : tests verts, `tests/db/isolation-core.test.ts` toujours vert

- [x] **4. Registre : origine, définitions d'outils, erreurs lisibles** [security]
  - Fichiers : `src/modules/actions/types.ts` (`ActionOrigin`, `origin` dans `ActionContext`), `registry.ts` (`invokeAction` exige `origin` ; `toToolDefinitions(channel, describe)`), `run.ts` (origine en argument serveur), `src/app/(app)/actions.ts` (palette → `palette`), `src/modules/core/actions.ts` (`.describe()` sur les champs)
  - Test à écrire d'abord : `src/modules/actions/registry.test.ts` — « contexte sans origine → `missing_context` » ; « `toToolDefinitions('assistant')` : nom, description en clair, JSON Schema valide sans `workspaceId`, `userId`, `origin` » ; `run.test.ts` — « l'origine ne vient jamais des paramètres »
  - Fini quand : tests verts, palette existante inchangée (`core.setLocale`)

- [x] **5. Module `tasks` : schémas, erreurs, lectures** [security]
  - Fichiers : `src/modules/tasks/schemas.ts` (zod, `.describe()` en anglais), `errors.ts` (`TaskError`, `TASK_ERROR_MESSAGES`), `queries.ts` (`isActive`, `listTasks` avec filtres, `query`, `limit`, `truncated`, `parentTitle` ; `getTask` ; `listDueToday(today)` ; `listTrashedTasks` ; `listTags`), `src/modules/tasks/sides.ts` si une valeur doit servir côté client (sans zod)
  - Test à écrire d'abord : `src/modules/tasks/queries.test.ts` — « tâche à la corbeille absente de toute lecture sauf la corbeille » ; « recherche `devis` sans casse, `100%` littéral » ; « limit 2 sur 3 → `truncated` » ; « terminées exclues par défaut » ; « lecture filtrée sur le workspace passé »
  - Fini quand : tests verts, chaque fonction prend `workspaceId` en premier et `tx` en dernier

- [x] **6. Mutations : création et modification** [security]
  - Fichiers : `src/modules/tasks/mutations.ts` (`createTask`, `updateTask`, `completeTask`, résolution d'un espace et de tags par nom, création de tags à la volée)
  - Test à écrire d'abord : `src/modules/tasks/mutations.test.ts` — « sous-tâche sans côté ni espace hérite de la parente » ; « changer côté ou espace de la parente suit sur ses sous-tâches, corbeille comprise, en une instruction » ; « sous-tâche de sous-tâche → `subtask_depth` » ; « update d'une sous-tâche avec côté → `subtask_follows_parent` » ; « `addTags` garde l'existant, `removeTags` retire seulement le nom donné, nom dans les deux → refus » ; « `completed_at` posé à `completed`/`canceled`, vidé sinon » ; « cocher la parente ne touche pas les sous-tâches » ; « tâche à la corbeille → `not_found` » ; « espace inconnu → `context_not_found` »
  - Fini quand : tests verts

- [x] **7. Mutations : corbeille et restauration** [security]
  - Fichiers : `src/modules/tasks/mutations.ts` (`moveTaskToTrash`, `restoreTask`)
  - Test à écrire d'abord : `src/modules/tasks/trash.test.ts` — « la parente et ses sous-tâches actives reçoivent le même horodatage » ; « la restauration ne ramène que les sous-tâches de cet horodatage » ; « sous-tâche dont la parente est à la corbeille → `parent_in_trash` »
  - Fini quand : tests verts

- [x] **8. Actions `tasks.*` au registre** [security]
  - Fichiers : `src/modules/tasks/actions.ts` (10 actions, canaux `web` et `assistant`), `src/modules/actions/registry.ts` (ajout de `tasksActions`), `messages/fr.json`, `messages/en.json` (descriptions des actions, libellés des codes d'erreur)
  - Test à écrire d'abord : `src/modules/tasks/actions.test.ts` — « chaque action valide ses paramètres en `strictObject` » ; « `limit: 500` refusé » ; « schéma de `tasks.update` sans champ `tags` » ; « chaque code d'erreur a un message anglais et une traduction FR/EN » ; `src/modules/actions/isolation.test.ts` étendu — « une action `tasks.*` avec la session de A ne lit ni n'écrit rien de B »
  - Aussi (spec « chaque refus » porte un message anglais, trou relevé à la review de la tâche 4) : message anglais pour un modèle des codes du registre (`unknown_action`, `invalid_params`, `missing_context`, sans recopier la valeur reçue) dans `src/modules/actions/errors.ts` ; descriptions anglaises de `core.*` réécrites pour un modèle ; jeu de paramètres valides des 10 actions dans `registry.test.ts` ; test qui fige la liste exacte des actions `write` exposées au canal `assistant` (liste blanche explicite, ADR-009) ; `tasks.list` filtre l'espace par son nom (`context`), résolu dans le workspace, refus `context_not_found`, aucun `contextId` exposé (spec « Identifiants ») ; un seul code de refus de paramètres : `invalid_input` du module `core` renommé `invalid_params`
  - Fini quand : tests verts, `toToolDefinitions('assistant')` renvoie les 10 actions

- [x] **9. Règles d'affichage : sections, sous-tâches, tuiles, raccourcis de date**
  - Fichiers : `src/modules/tasks/view.ts` (fonctions pures : `groupBySection(tasks, today)`, `todayTileItems`, `sideTileItems`, `subtaskCounter`, `dateShortcuts(today)`)
  - Test à écrire d'abord : `src/modules/tasks/view.test.ts` — « sous-tâche sans échéance absente, avec échéance dans sa section avec titre de parente » ; « en retard / aujourd'hui / demain / plus tard / sans échéance » ; « tuile Aujourd'hui : 3 premières, des deux côtés, compteurs » ; « ce week-end samedi et dimanche = aujourd'hui, lundi à vendredi = samedi suivant »
  - Fini quand : tests verts, aucun import de React ni de Next

- [x] **10. Server Actions de l'écran tâches** [security]
  - Fichiers : `src/app/(app)/tasks/actions.ts` (`"use server"`, `await requireSession()` en premier, appel du registre avec origine `app`, `settleAction` côté client)
  - Test à écrire d'abord : `src/app/(app)/tasks/actions.test.ts` — « origine `app` posée » ; « session absente → redirect » ; lint `tests/lint/unguarded-actions.ts` vert
  - Fini quand : tests verts

- [x] **11. Ajout rapide : coque extensible et bouton d'ajout**
  - Fichiers : `src/components/quick-add/quick-add-types.ts`, `QuickAdd.tsx` (tiroir mobile, dialogue ordinateur, sélecteur de types masqué sous deux types), `QuickAddProvider.tsx`, `src/components/shell/TabBar.tsx` (« + » → ajout rapide), `ShellHeader.tsx` (bouton d'ajout rond ordinateur ; accès palette sur mobile), `messages/*.json`
  - Test à écrire d'abord : `src/components/quick-add/QuickAdd.test.tsx` — « un seul type : pas de sélecteur » ; « deux types factices : sélecteur visible » ; `TabBar.test.tsx` — « le + ouvre l'ajout rapide » ; `ShellHeader.test.tsx` — « palette accessible sur mobile »
  - Fini quand : tests verts

- [ ] **12. Ajout rapide : formulaire tâche**
  - Fichiers : `src/components/tasks/TaskQuickAddForm.tsx`, `ContextChip.tsx`, `DueDateChip.tsx`, `TagsChip.tsx`
  - Test à écrire d'abord : `src/components/tasks/TaskQuickAddForm.test.tsx` — « titre seul → création avec côté et espace courants » ; « espace, date, tags en un tap » ; « tag inconnu → Créer « … » » ; « succès : titre, date, tags vidés, espace gardé, focus au titre » ; « échec : saisie conservée, message » ; « bouton désactivé titre vide et pendant l'appel »
  - Aussi (review tâche 11) : le tiroir suit le clavier (`visualViewport` `resize`/`scroll` pour remonter le tiroir ; `interactiveWidget: "resizes-content"` dans le `viewport` de `src/app/layout.tsx` pour Android), sans dépendance
  - Fini quand : tests verts ; vérifié sur un vrai iPhone (navigateur et app installée) que le bouton Ajouter reste visible clavier ouvert. Échec → décision d'Antoine (tiroir en haut ou plein écran)

- [ ] **13. Palette : ajouter une tâche**
  - Fichiers : `src/components/command-palette/commands.ts` (type `action` élargi aux noms du registre), `CommandPalette.tsx`, `PalettePanel.tsx`, `messages/*.json`
  - Test à écrire d'abord : `commands.test.ts` — « saisie libre → premier élément Ajouter la tâche « … » » ; « commandes Nouvelle tâche, Ouvrir la to-do, Corbeille » ; test de la Server Action — « origine `palette` »
  - Fini quand : tests verts

- [ ] **14. Liste `/tasks`**
  - Fichiers : `src/app/(app)/tasks/page.tsx`, `loading.tsx`, `error.tsx` (`retry()`), `src/components/tasks/TaskList.tsx`, `TaskRow.tsx`, `CompletedToggle.tsx`, `src/components/shell/nav-items.ts` (entrée To-do), `messages/*.json`
  - Test à écrire d'abord : `src/components/tasks/TaskList.test.tsx` — « sections, compteur n/m, légende parente » ; « case désactivée pendant l'appel, pas d'optimiste, erreur dans la ligne » ; « vide, vide filtré » ; `nav-items` — « To-do avant Réglages »
  - Aussi (review tâche 13) : palette sans doublon — retirer `/tasks` du groupe « Aller à » (la commande « Ouvrir la to-do » du groupe Tâches reste), le test « identifiant unique » de `commands.test.ts` reste vert
  - Fini quand : tests verts, page rendue à 390 px

- [ ] **15. Détail `/tasks/[id]`**
  - Fichiers : `src/app/(app)/tasks/[id]/page.tsx`, `src/components/tasks/TaskDetail.tsx`, `SubtaskList.tsx`, `messages/*.json`
  - Test à écrire d'abord : `src/components/tasks/TaskDetail.test.tsx` — « chaque champ appelle `tasks.update`, désactivé pendant l'appel, erreur sous le champ » ; « détail d'une sous-tâche : pas d'ajout de sous-tâche, lien vers la parente, côté et espace non modifiables » ; « corbeille puis Annuler restaure »
  - Fini quand : tests verts

- [ ] **16. Corbeille `/tasks/trash`**
  - Fichiers : `src/app/(app)/tasks/trash/page.tsx`, `src/components/tasks/TrashList.tsx`, `messages/*.json`
  - Test à écrire d'abord : `src/components/tasks/TrashList.test.tsx` — « parente avec + n sous-tâches » ; « Restaurer » ; « vide »
  - Fini quand : tests verts

- [ ] **17. Tuiles du tableau de bord**
  - Fichiers : `src/components/bento/TodayTile.tsx`, `src/components/tasks/SideTodoTile.tsx`, `src/modules/dashboard/tiles.ts`, `src/app/(app)/dashboard/page.tsx`, `messages/*.json`
  - Test à écrire d'abord : `TodayTile.test.tsx` — « compteurs en retard / aujourd'hui, 3 lignes, côté en légende, lien Tout voir » ; `SideTodoTile.test.tsx` — « 5 prochaines du côté, lien vers /tasks sur ce côté » ; « 5 lignes même avec des sous-tâches sans échéance » (lire plus de 5 tâches ou exclure ces sous-tâches dans la requête, `sideTileItems` les écarte) ; états vide et erreur
  - Fini quand : tests verts, DESIGN.md § 5 respecté (contraste de la tuile pleine)

- [ ] **18. Parcours e2e et passe design**
  - Fichiers : `e2e/todo-*.spec.ts` (scénarios 1 à 7 de la spec), corrections de style issues de l'anti-slop et de `/impeccable critique`
  - Test à écrire d'abord : les 7 scénarios en Playwright (`--workers=1`, Chromium émulation iPhone pour le 1)
  - Fini quand : e2e verts, anti-slop et critique passés sur liste, ajout rapide, détail ; scénario 1 rejoué sur un vrai iPhone (Playwright ne simule pas le clavier)

## Questions ouvertes
- [x] Recherche insensible aux accents : reportée (décision d'Antoine, 2026-11-19), ticket BRAIN-41.

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
