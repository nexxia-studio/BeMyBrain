# Handoff — état courant

**Dernière mise à jour** : 2026-11-12 — session : `/feature socle` (Claude Code)

## Où on en est
- Feature socle, branche `feat/socle` poussée, dernier commit `e541685`. Plan : `docs/features/socle/plan.md`.
- Cochées : 1 à 10 (dans « Terminé ») et 12 (encore dans « Tâches », à déplacer).
- Code fait, non coché : 11 (vérifs d'Antoine sur `dev`), 13 (essai d'installation, après 17), 17 (manuel restant).
- Thème clair (DESIGN.md § 8 accepté). Previews : option A (ADR-010). 436 tests verts, e2e 6/6 (rapporté, non relancé).
- Tests rouges : aucun rapporté.

## Prochaine étape
Antoine installe Impeccable (`/plugin marketplace add pbakaus/impeccable`), redémarre, puis :
`Lis docs/handoff.md et continue : tâche 14 de docs/features/socle/plan.md.`
Push libre sur `feat/socle` après chaque tâche ; jamais `main` sans accord.

## Manuel avant la fin de la tâche 17
- Neon : protéger `production` ; `revoke_sessions_on_password_reset` sur `production`.
- Neon : `drizzle.__drizzle_migrations` sur `test` doit compter les migrations 0000 à 0005.
- Vercel : créer le projet BeMyBrain (aucun n'existe). Étapes 1 à 11 de la tâche 17.

## Questions ouvertes
- Tâche 11 : `/dashboard` affiche « Espace de travail : BeMyBrain », reconnexion, pas de 500 après 5 min.
- Tâche 10 : décoder un vrai jeton (`iss`, `aud`) pour confirmer `NEON_AUTH_ISSUER` / `AUDIENCE`.
- Tâche 9 : une preview hérite-t-elle des comptes de `production` ? À vérifier en 17.

## Skills et agents pour la suite
1. Tâche 14 : `implementer` puis `reviewer`. Tâches 16 et 20 : `security-auditor` après `reviewer`.
2. Tâches 14, 15, 16 (UI) : skill `nexxia-design` + `references/anti-slop.md`, puis `/impeccable critique`.
3. Tâches 17, 18, 19 (`[manuel]`) : session principale via MCP, après accord d'Antoine. Puis `/qa socle`.
