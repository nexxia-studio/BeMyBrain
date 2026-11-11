# Handoff — état courant

**Dernière mise à jour** : 2026-11-11 — session : `/feature socle` (Claude Code)

## Où on en est
- Feature en cours : socle — spec validée, plan révisé : `docs/features/socle/plan.md` (18 tâches, tickets BRAIN-2 à BRAIN-7), avec ADR-006 (animation), ADR-007 (FR/EN), ADR-008 (PWA).
- Tâches faites : 0 — aucun code d'application dans le repo.
- Dernière action : les 4 questions ouvertes de la spec sont tranchées (jeton Neon Auth pour la RLS, sous-domaine Vercel, thème sombre d'abord, repo to-do `nexxia-studio/todo-perso-pro`).

## Prochaine étape (copier dans la prochaine session)
Sur la branche `feat/socle` :
`Exécute docs/features/socle/plan.md avec subagent-driven-development, en dispatchant subagent_type implementer pour chaque tâche et subagent_type reviewer pour chaque review.`
Tâche 1 à attaquer : « Adapter le kit à Neon + Drizzle » (BRAIN-2).

## Skills et agents pour la suite
1. `implementer` puis `reviewer` à chaque tâche.
2. `security-auditor` après le reviewer sur les tâches 6, 8, 9, 10, 11.
3. Tâches `[manuel]` (4, 9, 17, 18) : faites par la session principale via MCP Neon / Vercel après accord d'Antoine, ou par Antoine.
4. `/qa socle` quand le plan est fini.

## Attention
- Tests rouges : aucun (pas de tests encore).
- Le hook PostToolUse lance eslint sur chaque `.ts` édité : à la tâche 2, scaffold et `pnpm install` en Bash avant toute édition de `.ts`.
- `.gitignore` n'ignore pas encore `node_modules/` ni `.next/` : corrigé à la tâche 2.
- `CLAUDE.md` (§ Design, « une bibliothèque d'animation par arbre ») contredit l'ADR-006 : modification proposée à Antoine, pas encore faite.
- À vérifier à la tâche 9 : une branche preview hérite-t-elle des utilisateurs Neon Auth de `main` ?
