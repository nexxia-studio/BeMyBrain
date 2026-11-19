# Handoff — état courant

**Dernière mise à jour** : 2026-11-19 — session : `/feature todo-unifiee` (spec et plan)

## Où on en est
- Feature en cours : `todo-unifiee`, branche `feat/todo-unifiee` (partie de `feat/socle`, embarque le secret `SEED_OWNER_USER_ID`). Poussée.
- Spec validée le 2026-11-19 : `docs/features/todo-unifiee/spec.md`. Plan : `docs/features/todo-unifiee/plan.md`, 18 tâches, aucune cochée.
- DESIGN.md § 5 : tuile « Aujourd'hui » avec 3 lignes de tâches (validé). Roadmap : « Privé », calendrier en module à part, BRAIN-33 après la to-do.
- Tests rouges : aucun (rien codé).

## Prochaine étape
Antoine valide le découpage du plan, puis exécution à partir de la tâche 1 (fuseau en une seule fonction). Tâches 2 à 8 et 10 marquées `[security]` : `security-auditor` après le reviewer.

## Suite
- Essai Android (scénario 5) avant le multi-comptes (BRAIN-26) ; rôle owner/member et choix du workspace au même ticket.
- BRAIN-37 : ordre migration / mise en ligne, avant le premier module sensible (avec BRAIN-34, staging). Aucun Deployment Check actif ; parade = migrations rétrocompatibles.
- BRAIN-35 : source maps Sentry. BRAIN-36 : deux GET `/settings` par clic (faible priorité). BRAIN-33 : effets de verre.
- Limites QA-1 : lien profond avec session expirée → `/login` puis tableau de bord (retour seulement pour les actions) ; un `console.warn` par session expirée, volume à surveiller.

## Questions ouvertes
- `SEED_OWNER_USER_ID` passé en secret (2026-11-19, part avec la première PR de la to-do) ; Antoine supprime la variable GitHub après la fusion et un passage vert de « Migrer la production ».
- Jose non joué sur le vrai JWKS distant : kid inconnu sous 30 s avec réseau coupé ; cache périmé avec réseau coupé.
- E-mails Neon Auth : tutoient-ils ? Une preview hérite-t-elle des comptes de `production` ? (tâche 9)
- Règle Seer de la PR 1135934 laissée (organisation) ; issue de test BEMYBRAIN-1 encore ouverte dans Sentry.
- Jeton Vercel CI à renouveler avant le 2027-02-08 (échéance 2027-02-15).
- MCP Vercel sans accès au pare-feu (404) ; reconnecter l'intégration pour agir depuis Claude.

Commande de reprise :
`Exécute docs/features/todo-unifiee/plan.md avec subagent-driven-development, en dispatchant subagent_type implementer pour chaque tâche et subagent_type reviewer pour chaque review.`
