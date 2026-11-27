# Plan — Kanban des tâches, parente et relations (BRAIN-46)

**Spec** : `spec.md` · **Créé le** : 2026-11-25 · **Démo préalable** : retirée à la tâche 27 (D1–D9 faites ; son `demo-plan.md` est supprimé, l'essentiel est dans « Décisions de la démo » ci-dessous)

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

## Décisions de la démo (reprises de `demo-plan.md`, 2026-11-24)
- Bibliothèque : dnd-kit classique (`@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2). Sur iPhone, le glisser ne démarre qu'après un appui, ce qui garde le défilement ; la carte suit le doigt ; défilement automatique près des bords ; clavier et lecteur d'écran gérés. Écartées : Pragmatic DnD (glisser natif, déclenchement et aperçu imposés par iOS), sans bibliothèque (environ 500 lignes de détection, défilement et accessibilité à maintenir).
- Mobile : colonnes à défilement horizontal, ou une colonne à la fois avec onglets (dépôt sur un onglet = changement de colonne).
- Mise à jour optimiste limitée au déplacement : échec → retour animé + « Déplacement non enregistré » avec Réessayer. Terminée : 20 plus récentes + « Tout voir » ; Annulée : bandeau replié, on peut y déposer.
- Risque connu : `useUniqueId` de dnd-kit donne des `aria-describedby` différents serveur/client → `id` stable (`useId()`) passé à `DndContext`.

## Tâches

Toutes les tâches sont cochées : voir « Terminé ». Il reste la correction R2 (ci-dessous).

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

## Corrections de relecture (2026-11-26)
- [ ] **R2. Carte « gardée de mémoire » refusée en silence** — `src/components/tasks/TaskBoard.tsx` : dans une colonne fermée de plus de 20 cartes, la carte tout juste déposée se saisit puis revient sans message. Tranchée : ticket BRAIN-65 (carte non déplaçable dans une colonne fermée de plus de 20 cartes), pas de correction dans cette PR.

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. Déplacées le 2026-11-27 ; date = date de fin de la tâche. -->
- **1. Clé d'ordre et parente en écriture** [security] — 2026-11-25 (`fff30aa`)
- **2. Clés d'ordre fractionnaires** — 2026-11-25 (`400c76d`)
- **3. Table des relations** [security] — 2026-11-25 (`7b09bc7`)
- **4. Déplacer une tâche dans le tableau (`moveTask`)** [security] — 2026-11-25 (`42119a3`)
- **5. Arrivées hors dépôt en tête de colonne** — 2026-11-25 (`6cf755a`)
- **6. Priorité héritée à la création d'une sous-tâche** — 2026-11-25 (`b0531ab`)
- **7. Rattacher, changer, détacher la parente (`setTaskParent`)** [security] — 2026-11-25 (`2111ba3`)
- **8. Ajouter et retirer une relation** [security] — 2026-11-25 (`5b8a46f`)
- **9. Lire le tableau, les relations et « bloquée »** — 2026-11-25 (`b5857f2`)
- **10. Déclarer les actions au registre** [security] — 2026-11-25 (`251048f`)
- **11. Charte : teintes de priorité, Creux, exceptions** — 2026-11-25 (`d765194`, `70259ea`) ; validée par Antoine
- **12. Teinte de priorité partout** — 2026-11-26 (`8292307`) ; validée sur iPhone
- **13. Survol et empreinte, Creux par défaut** — 2026-11-26 (`195c93b`)
- **14. Cible de dépôt lisible sur mobile** — 2026-11-26 (`58d753f`)
- **15. Colonne repliable sur place (Annulée)** — 2026-11-26 (`079239b`)
- **16. Carte d'une tâche réelle** — 2026-11-26 (`7c7c044`)
- **17. File des déplacements optimistes** — 2026-11-26 (`98f25fc`)
- **18. Mémoriser la vue Liste ou Tableau** — 2026-11-26 (`a05bdb4`)
- **19. Mémoriser les options du tableau** — 2026-11-26 (`fe1645b`)
- **20. Afficher le tableau sur `/tasks`** — 2026-11-26 (`f89d513`, `8e577d2`, `20bf1f1`) ; « Tout voir » non joué à l'e2e (moins de 21 tâches terminées sur le compte e2e)
- **21. Prouver le tableau en e2e** — 2026-11-26 (`986434e`)
- **22. Contraste Creux dans la vue liste** — 2026-11-26 (`dadd08d`)
- **23. Titre du détail éditable d'un tap** — 2026-11-27 (`56bb592`)
- **24. Liste de sélection de tâche (`TaskPicker`)** — 2026-11-27 (`105a1f7`)
- **25. Propriété « Tâche parente »** — 2026-11-27 (`3d7980c`)
- **26. Section « Relations » et pastille « Bloquée »** — 2026-11-27 (`61512ad`)
- **27. Retrait de la démo, docs alignées** — 2026-11-27 (`7228360`)
- **28. Revue de design et suite complète** — 2026-11-27 ; critique 29/40, 2 P1 : détail corrigé, tableau 3/5 colonnes à décider (archive `.impeccable/critique/`, gitignorée)
- **R1. Colonne visée bornée à la partie visible du tableau** — 2026-11-27 (`57fccf4`)
- **R3. e2e du tableau durcis** — 2026-11-27 (`cab1223`)
- **R4. Porter sur le tableau réel avant retrait de la démo** — 2026-11-27 (`b53ccfb`)
- **R5. Mineurs (`retry` retiré, exception de survol, commentaire)** — 2026-11-27 (`cc77ab1`)
- **R6. Garde beforeunload pendant un déplacement en attente** — 2026-11-27 (`bbc8b0b`)
