# Handoff — état courant

**Dernière mise à jour** : 2026-11-25 — session : `/handoff` après fusion de la PR A de BRAIN-46

## Où on en est
- BRAIN-46 `todo-kanban` : spec validée, plan de 28 tâches en deux PR.
- PR A (tâches 1 à 10, données et registre) fusionnée dans `main` le 2026-11-25 (`9d86140`). Migrations 0008 à 0010 appliquées en production par la CI ; « Migrer la production » vert, déploiement réussi.
- PR B = PR #14 `feat/todo-kanban`, brouillon, à jour de `main`, HEAD `ab59efb`. Blocs B, C, D à faire dessus.
- Tâche 11 faite : teintes de priorité (rouge, orangé, jaune, vert), tokens `priority-*`, DESIGN.md amendé (le rouge d'Urgente amende la règle de la braise). Relecture en cours.
- Design de la démo validé par Antoine (variante Creux, détail Nouveau) ; appui long intouché.
- Tickets : BRAIN-57 à BRAIN-63 créés (automatismes parente, sous-tâches en liste, côté en base, contraintes, délais de verrou, tests de base, boucles de blocage) ; BRAIN-39 complété.
- BRAIN-50 reste OUVERT « à confirmer en production » (aucune ligne « Nouvelle tentative » sur preview).
- Restes BRAIN-50 (état du 2026-11-24, non revérifié) : ~35 `rejects.toMatchObject` à passer sur `errorTag` ; e2e `todo-chargement` ; scénario 2 de `/qa` et `--suspend` non joués.
- Règle : aucune migration sur la branche Neon `test` avant la fusion de sa PR.
- Tests rouges : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`). `pnpm lint` rouge en local à cause de `qa-screenshots/` (gitignoré).

## Prochaine étape
Validation des teintes par Antoine sur la preview (iPhone), puis tâche 12. En attendant : tâches 13 et suivantes du bloc B (indépendantes des teintes).
Commande de reprise : `Lis docs/handoff.md et docs/features/todo-kanban/plan.md. Si Antoine a validé les teintes de priorité, exécute la tâche 12 ; sinon reprends à la tâche 13 (implementer, reviewer, pas de migration sur test avant fusion). Appui long intouché.`

## Suite et questions ouvertes
- BRAIN-51 (durcissements du pool), BRAIN-53, BRAIN-52. Faible priorité : BRAIN-43, 44, 45. BRAIN-55 (retour visible à l'ouverture d'un détail lent). Inchangés : BRAIN-26, 37, 35, 36, 49.
- Design à trancher (`effets-de-verre`, tâche 18) : menus Date et Tags mobile, Notes, « Demain » le vendredi, place vide à 1440 px, survol.
- `/impeccable critique` à relancer à la tâche 28 (premier passage 24/40, archive `.impeccable/critique/`). `.impeccable/design.json` plus ancien que DESIGN.md.
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte ; Antoine supprime la variable GitHub.
- jose : JWKS distant non joué. E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer PR 1135934 laissée ; BEMYBRAIN-1 ouverte. Jeton Vercel CI à renouveler avant le 2027-02-08 ; MCP Vercel sans accès au pare-feu (404).
