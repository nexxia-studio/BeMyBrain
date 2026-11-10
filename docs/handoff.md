# Handoff — état courant

**Dernière mise à jour** : 2026-11-10 — session : cadrage (claude.ai, Projet Nexxia)

## Où on en est
- Feature en cours : socle — `docs/features/socle/spec.md` (brouillon, pas encore de plan)
- Tâches faites : 0 — aucun code d'application dans le repo
- Dernière action : repo créé depuis le kit, docs adaptées à BeMyBrain (Next.js + Neon), feuille de route et ADR 001 à 004 écrits

## Prochaine étape (copier dans la prochaine session)
`/feature socle` — la spec existe déjà dans docs/features/socle/spec.md : la relire avec Antoine, trancher ses questions ouvertes, puis écrire le plan.

## Skills et agents pour la suite
1. `explorer` : rien à cartographier côté code ; lire `docs/architecture.md`, `docs/roadmap.md` et les ADR.
2. `writing-plans` pour `docs/features/socle/plan.md`, puis `subagent-driven-development` avec `implementer` / `reviewer`.
3. `security-auditor` sur les tâches d'auth et de session, puis `/qa socle`.

## Attention
- Tests rouges : aucun (pas de tests encore)
- Fichiers modifiés non commités : aucun
- Le kit citait Supabase : `.claude/agents/security-auditor.md`, `.claude/agents/explorer.md`, `.claude/skills/feature/SKILL.md`, `.claude/rules/frontend.md`, `.claude/rules/tests.md`, `docs/features/_template/plan.md` et `docs/instructions-projet-claude-ai.md` sont à adapter à Neon + Drizzle (ticket Linear du projet « 0 · Socle »).
- Questions ouvertes pour Antoine : voir la fin de `docs/features/socle/spec.md`.
