# ADR-002 — Isoler par `workspace_id` dans le code, RLS avant le multi-comptes

**Date** : 2026-11-10 · **Statut** : accepté

## Contexte
V1 : un seul compte. Plus tard : un abonnement = un compte isolé.
Ajouter une clé de compte après coup sur toutes les tables est très coûteux. La RLS Postgres avec Drizzle demande de fixer le compte courant à chaque requête.

## Décision
Dès la première migration, toute table métier porte `workspace_id NOT NULL`.
En V1, l'isolation est faite dans le code : seules les fonctions de `src/modules/<module>/` touchent la base, et toutes filtrent sur le `workspaceId` de la session. Un test par module vérifie qu'un autre workspace ne voit rien.
La RLS Postgres est activée sur toutes les tables avant d'ouvrir un deuxième compte.

## Alternatives écartées
- RLS dès la V1 — plus sûr, mais ralentit chaque module pour un risque nul tant qu'il n'y a qu'un compte.
- Pas de `workspace_id` en V1 — migration lourde et risquée le jour de l'ouverture.

## Conséquences
- L'ouverture multi-comptes est bloquée par une feature « RLS » obligatoire, avec passage du `security-auditor`.
- Les liens de partage publics (liste de courses) sont le seul accès sans session ; ils passent par un jeton dédié.
