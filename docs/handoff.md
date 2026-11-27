# Handoff — état courant

**Dernière mise à jour** : 2026-11-27 — `/handoff` avant `/clear`, branche `feat/todo-kanban`, HEAD `7f30e74`

## Où on en est
- BRAIN-46 : PR A fusionnée dans `main` le 2026-11-25 (`9d86140`), en production.
- PR B = PR #14 (brouillon) : tâches 11 à 28 faites et relues ; R1, R3 à R6 faites ; R2 tranchée (BRAIN-65).
- Essai iPhone du 2026-11-27 : décisions appliquées (tableau vide, heure sur la carte, Annulée mémorisée, survol dans ADR-006).
- Critique `/impeccable` : 29/40 (24 avant), 0 P0, 2 P1 : détail corrigé ; tableau ordinateur à trancher.
- Vérifié : `pnpm test` 3082 tests verts ; typecheck vert ; e2e complet sur `next start` vert hors BRAIN-52.

## Arrêt : points à trancher par Antoine
- Tableau ordinateur : 3 colonnes sur 5 visibles à 1280 et 1920 px. Options : lever le plafond de 1400 px sur `/tasks` en Tableau, colonnes 260–280 px, ou amorce à droite comme sur mobile.
- Lâcher hors du tableau : la carte reste dans sa colonne (11ee858). Confirmer, ou dépose dans la dernière colonne visitée.
- Heure en anglais : 12 h ou 24 h (24 h en FR et EN pour l'instant) ; décision commune aux 4 endroits.
- Essais iPhone à faire : clavier au tap du titre, du sélecteur de parente et de relation ; défilement de la liste clavier ouvert ; pastille Bloquée.
- Restes de la critique : anneau de focus sur la croix du détail, « Bloquée » en tête du détail, « Sous-tâches » ambigu, « BeMyBrain » tronqué en EN à 390 px.

## Prochaine étape
Trancher les points ci-dessus, puis `/qa todo-kanban` (non lancé), puis sortir la PR #14 du brouillon sur accord d'Antoine.
Reprise : `Lis docs/handoff.md et docs/features/todo-kanban/plan.md. Demande à Antoine ses décisions sur les points à trancher du handoff, applique-les, puis lance /qa todo-kanban ; ne sors la PR #14 du brouillon qu'avec son accord.`

## Règles et tests rouges
- Aucune migration sur la branche Neon `test` avant fusion de sa PR ; après fusion, `pnpm db:migrate` sur la base de développement. Push libre sur la branche ; `main` sur accord.
- Rouge : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`) ; `pnpm lint` rouge en local à cause de `qa-screenshots/` (gitignoré).

## Questions ouvertes
- BRAIN-50 « à confirmer en production » (« Nouvelle tentative sur le pool » dans les journaux Vercel de prod). À revérifier : `rejects.toMatchObject` sur `errorTag`, `/qa` scénario 2, `--suspend`.
- Retour arrière après expiration de session : tableau réaffiché par Next jusqu'au prochain chargement ; décision produit, à passer au `security-auditor`.
- `SEED_OWNER_USER_ID` : secret en place ; Antoine supprime la variable GitHub. jose : JWKS distant non joué.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : BEMYBRAIN-1 ouverte. Jeton Vercel CI avant le 2027-02-08 ; MCP Vercel sans accès au pare-feu (404).
- Design `effets-de-verre` (non revérifié) : menus Date et Tags mobile, Notes, place vide à 1440 px, survol.
- Tickets : BRAIN-64 (flèche après Espace), BRAIN-65 (carte dans colonne fermée > 20 cartes), BRAIN-51, 53, 55, 26, 35, 36, 37, 49 ; faible priorité BRAIN-43, 44, 45.
