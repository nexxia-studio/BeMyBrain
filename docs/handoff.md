# Handoff — état courant

**Dernière mise à jour** : 2026-11-27 — `/handoff` après fusion de PR #14, branche `main`, HEAD `20b06d4`

## Où on en est
- BRAIN-46 (kanban des tâches) livrée : PR A (#15) et PR B (#14) fusionnées dans `main`, tableau en production.
- `/qa todo-kanban` : 11/11 PASS (`docs/features/todo-kanban/qa-report.md`). Essai iPhone du 2026-11-27 : OK.
- Décisions appliquées : tableau sans plafond, fondu à droite, colonnes à 320 px (280 px écarté, QA-1) ; carte lâchée hors tableau dans la dernière colonne survolée ; heure en 24 h en FR et EN.
- Vérifié : `pnpm test` 3089 verts ; typecheck vert ; lint rouge à cause de `qa-screenshots/` (gitignoré).
- Aucune migration dans la PR B.

## Prochaine étape
Choisir la prochaine feature dans `docs/roadmap.md`, puis `/clear`, `/model opus`, `/feature <nom>`.
Reprise : `Lis docs/handoff.md et docs/roadmap.md. Avec Antoine, choisis la prochaine feature, puis lance /feature <nom> sur Opus.`

## Règles et tests rouges
- Migrations : aucune à lancer pour ce merge. Branche Neon `test` : jamais avant la fusion de la PR qui porte la migration ; après fusion, `pnpm db:migrate` sur la base de développement.
- Push libre sur la branche ; `main` sur accord.
- Rouge à revérifier : BRAIN-52 (`e2e/todo-aujourdhui.spec.ts`) ; `pnpm lint` (`qa-screenshots/`).

## Questions ouvertes
- BRAIN-50 « à confirmer en production » : `rejects.toMatchObject` sur `errorTag`, `/qa` scénario 2, `--suspend`.
- BRAIN-67 (moyenne) : tableau réaffiché par le retour arrière après expiration ou déconnexion de session ; à passer au `security-auditor`, cas de la déconnexion explicite à vérifier.
- `SEED_OWNER_USER_ID` : secret en place ; Antoine supprime la variable GitHub. jose : JWKS distant non joué.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : BEMYBRAIN-1 ouverte. Jeton Vercel CI avant le 2027-02-08 ; MCP Vercel sans accès au pare-feu (404).
- Design `effets-de-verre` (non revérifié) : menus Date et Tags mobile, Notes, place vide à 1440 px, survol.
- Reste de design kanban (critique 29/40, non traité dans le code) : anneau de focus sur la croix du détail, « Bloquée » en tête du détail, « Sous-tâches » ambigu, « BeMyBrain » tronqué en EN à 390 px ; environ 120 px vides à droite à 1920 px (QA, à valider).
- Tickets : BRAIN-64 (flèche après Espace : KO à 280 px, OK à 320 px), BRAIN-65 (carte dans colonne fermée > 20 cartes), BRAIN-66 (formateur d'heure, 12 h en EN, faible), BRAIN-51, 53, 55, 26, 35, 36, 37, 49 ; faible priorité BRAIN-43, 44, 45.
