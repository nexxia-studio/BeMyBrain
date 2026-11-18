# Handoff — état courant

**Dernière mise à jour** : 2026-11-18 — session : `/feature socle` puis `/handoff` (Claude Code)

## Où on en est
- `feat/socle` à `8093468`, poussée ; `main` à `a462ee7` (PR #3 et #4 fusionnées). Plan : `docs/features/socle/plan.md`.
- Production en ligne, connexion et espace d'Antoine OK (fr ; contextes Privé, Trustup, Nexxia).
- Cochées : 1 à 16, 20, 21. Ouvertes : 17 (reste manuel), 18, 19. Corps des tâches 11 à 16, 20, 21 à déplacer dans « Terminé ».
- Pare-feu `limite-connexion` testé : 12 GET en 200, 11e et 12e POST en 403.
- Tests : 830 verts à la tâche 21 (2026-11-17, non relancé). Tests rouges : aucun rapporté.

## Prochaine étape
Confirmer avec Antoine l'étape 9 de la tâche 17 (Deployment Checks « Migrer la production » importé par SHA) ; puis cocher 17 (Android noté restant) et faire la tâche 18.

Commande de reprise :
`Lis docs/handoff.md et docs/features/socle/plan.md, puis continue : confirme avec moi l'étape 9 de la tâche 17, puis tâche 18.`

## Suite
- Tâche 18 : restauration de `production` sur une branche de test, lecture du workspace, suppression ; fenêtre notée (6 h en gratuit). Runbook dans `docs/`.
- Tâche 19 : `console.error` de `src/app/(app)/actions.ts` → `captureException` ; Sentry (région UE), alerte Slack (manuel).
- Puis `/qa socle`, `/handoff` final. Push libre sur `feat/socle`, jamais `main` sans accord.

## Questions ouvertes
- E-mails Neon Auth : vérifier qu'ils tutoient. Tâche 9 : une preview hérite-t-elle des comptes de `production` ? À confirmer.
- MCP Vercel sans accès au pare-feu (404) ; reconnecter l'intégration pour agir depuis Claude.
- Revue 21 optionnelle : `typedEmail` recopié. Jeton Vercel CI : échéance 2027-02-15. Clone local : `main` en retard, `git pull` avant comparaison.
