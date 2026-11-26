# Handoff — état courant

**Dernière mise à jour** : 2026-11-26 — `/handoff` avant `/clear`, branche `feat/todo-kanban`, HEAD `7cba7fc` poussé

## Où on en est
- BRAIN-46 : PR A (tâches 1 à 10, migrations 0008 à 0010) fusionnée dans `main` le 2026-11-25 (`9d86140`), en production.
- PR B = PR #14 (brouillon) : tâches 11 à 22 faites et relues ; reste 23 à 28 (`docs/features/todo-kanban/plan.md`).
- Teintes de priorité validées sur iPhone par Antoine le 2026-11-26, appliquées partout (tâche 12).
- Tableau réel sur `/tasks` (tâche 20) ; `e2e/todo-kanban.spec.ts` : 27 tests verts deux fois de suite.
- À confirmer par Antoine : exception dans `SortableBoard` (`e41379a`), dépôt dans une colonne vide et haute, ordinateur seulement. Appui long, capteurs, délai, soulèvement intouchés.

## Arrêt : essai iPhone du tableau réel (points à trancher)
- Repère « nom + compteur » de l'onglet visé pendant un glisser.
- Sélecteur de vue réduit à deux icônes sous 640 px.
- Rangée d'options sur deux lignes (94 px) sur iPhone.
- Tableau sans tâche : cinq colonnes vides, sans message.
- Liste en Creux : page plus longue d'environ 100 px pour 5 sections.
- Heure d'échéance absente des cartes ; bandeau Annulée « Annulée, 3 cartes, déplier ».
- Clavier : une flèche juste après Espace sans effet (cause non établie).
- Recharger juste après avoir déplié Annulée perd l'état.
- Carte déposée dans une colonne fermée de plus de 20 cartes : non déplaçable avant « Tout voir ».
- Survol de carte en CSS, exception à ADR-006 : écrite dans DESIGN.md seulement.

## Prochaine étape
Essai iPhone et décisions d'Antoine, puis tâche 23 (titre éditable d'un tap). Restes : 23 à 26 (détail), 27 (retrait de la démo), 28 (anti-slop, `/impeccable critique`, suite complète), puis `/qa todo-kanban`.
Reprise : `Lis docs/handoff.md et docs/features/todo-kanban/plan.md. Demande à Antoine le résultat de son essai iPhone du tableau réel et ses décisions sur les points à trancher du handoff ; applique-les, puis enchaîne les tâches 23 à 28 (implementer, reviewer ; aucune migration sur test avant fusion ; appui long intouché). Avant la tâche 27, traite la section « Corrections de relecture à faire avant la tâche 27 » du plan (R1 à R6).`

## Règles et tests rouges
- Aucune migration sur la branche Neon `test` avant fusion de sa PR ; après fusion, `pnpm db:migrate` sur la base de développement. Push libre sur la branche ; `main` sur accord.
- Rouge : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`) ; `pnpm lint` rouge en local à cause de `qa-screenshots/brain-50/` (gitignoré).

## Suite et questions ouvertes
- BRAIN-50 « à confirmer en production » (chercher « Nouvelle tentative sur le pool » dans les journaux Vercel de prod). Restes, non revérifiés depuis le 2026-11-24 : `rejects.toMatchObject` à passer sur `errorTag`, e2e `todo-chargement`, `/qa` scénario 2 et `--suspend`.
- BRAIN-57 à BRAIN-63 créés ; BRAIN-39 complété. Autres tickets inchangés : BRAIN-51, 53, 55, 26, 35, 36, 37, 49 ; faible priorité BRAIN-43, 44, 45.
- `SEED_OWNER_USER_ID` : secret en place ; Antoine supprime la variable GitHub. jose : JWKS distant non joué.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer de la PR 1135934 laissée ; BEMYBRAIN-1 ouverte. Jeton Vercel CI avant le 2027-02-08 ; MCP Vercel sans accès au pare-feu (404).
- Tâche 28 : `/impeccable critique` à relancer (premier passage 24/40, `.impeccable/critique/`). Design `effets-de-verre` (non revérifié) : menus Date et Tags mobile, Notes, place vide à 1440 px, survol.
