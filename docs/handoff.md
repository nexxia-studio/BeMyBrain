# Handoff — état courant

**Dernière mise à jour** : 2026-11-18 — session : `/handoff` de clôture du socle (Claude Code)

## Où on en est
- Socle clos le 2026-11-18. PR #7 fusionnée : `main` à `20c1fce`, production en ligne sur ce commit, sans nouvelle migration. Plan : `docs/features/socle/plan.md` (tâches 1 à 21, QA-1, QA-2 dans « Terminé »).
- QA-1 (session expirée pendant une action → `/login?next=`, retour sur la page) et QA-2 (`/login` ouvert connecté → tableau de bord) : reviewer OK, security-auditor OK (QA-1).
- `/qa socle` du 2026-11-18 : 5 PASS, 0 FAIL, scénario 5 non joué (`docs/features/socle/qa-report.md`).
- Tests : 1218 verts (`pnpm test`). e2e session-expiree, connecte-sur-login, acces-refuse, premiere-connexion verts (`--workers=1`). Tests rouges : aucun.
- `feat/socle` reste poussée. Les docs de clôture ne rejoignent `main` qu'avec une PR, sur accord d'Antoine.

## Prochaine étape
Antoine choisit le premier module après le socle, puis `/clear` et `/feature <nom>`. Candidats phase 1 (`docs/roadmap.md`) : to-do unifiée (`tasks`, migration depuis `todo-perso-pro`), bucket lists et liste de courses (`lists`). Choix non tranché ici.

## Suite
- Essai Android (scénario 5) avant le multi-comptes (BRAIN-26) ; rôle owner/member et choix du workspace au même ticket.
- BRAIN-37 : ordre migration / mise en ligne, avant le premier module sensible (avec BRAIN-34, staging). Aucun Deployment Check actif ; parade = migrations rétrocompatibles.
- BRAIN-35 : source maps Sentry. BRAIN-36 : deux GET `/settings` par clic (faible priorité). BRAIN-33 : effets de verre.
- Limites QA-1 : lien profond avec session expirée → `/login` puis tableau de bord (retour seulement pour les actions) ; un `console.warn` par session expirée, volume à surveiller.

## Questions ouvertes
- Journal GitHub Actions « Migration production » : `SEED_OWNER_USER_ID` affiché en clair (dépôt public), à passer en secret (cf. `docs/gotchas.md`, `vars.*`). Non traité.
- Jose non joué sur le vrai JWKS distant : kid inconnu sous 30 s avec réseau coupé ; cache périmé avec réseau coupé.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ? (tâche 9)
- Règle Seer de la PR 1135934 laissée (organisation) ; issue de test BEMYBRAIN-1 encore ouverte dans Sentry.
- Jeton Vercel CI à renouveler avant le 2027-02-08 (échéance 2027-02-15).
- MCP Vercel sans accès au pare-feu (404) ; reconnecter l'intégration pour agir depuis Claude.

Commande de reprise :
`Lis docs/handoff.md, demande à Antoine le premier module après le socle, puis après /clear lance /feature <nom>.`
