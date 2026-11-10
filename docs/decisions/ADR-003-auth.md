# ADR-003 — Choisir la solution de connexion

**Date** : 2026-11-10 · **Statut** : proposé — à trancher par Antoine au `/feature socle`

## Contexte
Neon ne remplace pas Supabase Auth à l'identique. Il faut une connexion simple en V1 (un compte) qui tienne en multi-comptes avec abonnement.

## Décision
Proposition : Neon Auth, pour garder les utilisateurs dans la même base et les mêmes branches que les données.
À vérifier dans la doc Neon au moment de la spec : état du produit, limites de la formule gratuite, gestion des organisations.

## Alternatives écartées
- Better Auth installé dans l'app — plus de contrôle, plus de code à maintenir.
- Clerk — très rapide à brancher, mais les utilisateurs vivent hors de la base et le prix monte avec les comptes.

## Conséquences
- Le choix fixe la forme de la table des membres et la façon de résoudre le `workspaceId`.
- Tant que le statut est « proposé », aucune tâche d'auth ne démarre.
