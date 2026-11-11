# ADR-009 — Déclarer les actions dans un registre partagé

**Date** : 2026-11-11 · **Statut** : accepté

## Contexte
La palette de commandes arrive dès le socle. Plus tard, l'assistant IA, WhatsApp et Slack (via Hermes) devront déclencher les mêmes actions. Des actions recodées par canal divergeraient.

## Décision
- Un registre unique dans `src/modules/actions/`, sans dépendance à React ni à Next.
- Chaque action déclare : `name` (stable, ex. `core.setLocale`), `description` (clé de traduction, ADR-007), `params` (schéma zod), `access` (`read` ou `write`), et `run(ctx, params)`.
- `ctx` contient `workspaceId` et `userId` issus de la session serveur, jamais des paramètres. `run` appelle uniquement les fonctions de `src/modules/<module>/` (ADR-002, ADR-004).
- Paramètres validés avant `run` ; une action `write` refuse de s'exécuter sans `ctx` complet.
- La palette n'appelle les actions que par une Server Action unique qui résout la session puis le registre. Les simples raccourcis de navigation ne sont pas des actions.

## Alternatives écartées
- Actions définies dans les composants de la palette : inutilisables par l'assistant, WhatsApp et Slack.
- Exposer directement `queries.ts` et `mutations.ts` : pas de description ni de schéma lisibles par un agent.

## Conséquences
- Chaque module qui veut être appelable déclare ses actions dans le registre.
- L'assistant IA (ADR-004) ne voit que les actions `read`, sauf liste blanche explicite.
