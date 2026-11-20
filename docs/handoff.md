# Handoff — état courant

**Dernière mise à jour** : 2026-11-20 — session : `/handoff` après fusion de la to-do

## Où on en est
- To-do unifiée fusionnée : PR #8 et #9 dans `main` (fusion `19f32a5`). Branche `feat/todo-unifiee` locale, non poussée.
- Plan : 18 tâches cochées, déplacées dans « Terminé ». QA 7/7 (`docs/features/todo-unifiee/qa-report.md`). 1745 Vitest, lint et types verts.
- Production après fusion : « Migrer la production » vert, 8 migrations, en-têtes de sécurité présents, Sentry sans issue nouvelle.
- Libellés de statut : À planifier, À faire, En cours, Terminée, Annulée. « En attente » réservé à la tranche 2.
- Tests rouges : aucun.

## Prochaine étape
`/clear` puis `/feature effets-de-verre` (BRAIN-33). Avant la spec : lire DESIGN.md, ADR-006 et `docs/design/references/`.

## Suite
- Ticket à créer, proposé à Antoine : erreur du détail affichée par `tasks/error.tsx` sous la liste. Correction : `error.tsx` dans `@detail`.
- Faible priorité : BRAIN-43 (relais iOS, libéré à la fin de l'ouverture du tiroir), BRAIN-44 (contrôles désactivés après un ajout), BRAIN-45 (pagination de la corbeille).
- Design à trancher (plan, tâche 18) : menus Date et Tags sur mobile, Notes trop haut, « Demain » = « Ce week-end » le vendredi, place vide à 1440 px, survol, icônes de priorité (ticket proposé).
- BRAIN-26 : essai Android, owner/member, choix du workspace. BRAIN-37 : ordre migration / mise en ligne. BRAIN-35 : source maps Sentry. BRAIN-36 : deux GET `/settings` par clic.
- QA-1 : lien profond avec session expirée → `/login` puis tableau de bord.

## Questions ouvertes
- `SEED_OWNER_USER_ID` : secret GitHub en place, migration verte. Antoine supprime la variable GitHub.
- jose : JWKS distant non joué (kid inconnu sous 30 s, réseau coupé ; cache périmé).
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ?
- Sentry : règle Seer de la PR 1135934 laissée ; BEMYBRAIN-1 ouverte.
- Jeton Vercel CI à renouveler avant le 2027-02-08. MCP Vercel sans accès au pare-feu (404).

Commande de reprise :
`/clear` puis `/feature effets-de-verre`
