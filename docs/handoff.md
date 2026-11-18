# Handoff — état courant

**Dernière mise à jour** : 2026-11-18 — session : `/qa socle` puis `/handoff` (Claude Code)

## Où on en est
- `feat/socle` à `98a011a` (code et docs), poussée ; `main` à `91caed4` (PR #5 et #6 fusionnées). Plan : `docs/features/socle/plan.md`.
- Tâches 1 à 21 closes ; corps des tâches 11 à 21 déplacés dans « Terminé ».
- Tâche 17 close avec limite : aucun Deployment Check actif, Vercel peut mettre la production en ligne avant la fin de la migration. Parade : migrations rétrocompatibles ; suite BRAIN-37.
- Production en ligne sur `91caed4`. `/qa socle` du 2026-11-18 : 5 PASS, 0 FAIL, scénario 5 non joué (`docs/features/socle/qa-report.md`).
- Tests : 1 067 verts (passage complet 2026-11-18). Tests rouges : aucun.

## Prochaine étape
QA-1 (session expirée → `/login`, [security]) puis QA-2 (`/login` ouvert connecté → `/dashboard`) : implementer en TDD, reviewer, security-auditor pour QA-1 ; puis clôture du socle.

## Suite
- Clôture : PR vers `main` seulement sur accord d'Antoine ; `/handoff` final.
- Essai Android (scénario 5) reporté avant le multi-comptes (BRAIN-26).
- BRAIN-35 : source maps Sentry (garde-fou de build). BRAIN-36 : deux GET `/settings` par clic (faible priorité). BRAIN-37 : ordre migration / mise en ligne, avant le premier module sensible.

## Questions ouvertes
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ? (tâche 9)
- Règle Seer de la PR 1135934 laissée (organisation).
- Issue de test BEMYBRAIN-1 encore ouverte dans Sentry.
- Jeton Vercel CI à renouveler avant le 2027-02-08 (échéance 2027-02-15).
- MCP Vercel sans accès au pare-feu (404) ; reconnecter l'intégration pour agir depuis Claude.

Commande de reprise :
`Lis docs/handoff.md et docs/features/socle/plan.md, puis exécute les corrections QA-1 et QA-2 du plan socle avec subagent-driven-development (implementer, reviewer, security-auditor pour QA-1), puis prépare la clôture du socle.`
