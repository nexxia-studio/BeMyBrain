# ADR-002 — Isoler les comptes dans la base (RLS) dès le socle

**Date** : 2026-11-10 · **Statut** : accepté (remplace la première version du même jour, qui repoussait la RLS au multi-comptes)

## Contexte
V1 : un seul compte. Plus tard : un abonnement = un compte isolé.
Exigence d'Antoine : le compte X ne doit jamais voir ni modifier les données du compte Y, et l'inverse. Il préfère une base solide dès maintenant plutôt qu'un chantier de sécurité plus tard.

## Décision
Double verrou dès la première migration :
1. **Dans la base** : toute table métier porte `workspace_id NOT NULL`, la RLS est activée dans la même migration que la création de la table, avec une policy par verbe (SELECT, INSERT, UPDATE, DELETE) qui n'autorise que les lignes des workspaces dont l'utilisateur connecté est membre. Les policies sont déclarées dans le schéma Drizzle.
2. **Dans le code** : seules les fonctions de `src/modules/<module>/` touchent la base, et toutes filtrent sur le `workspaceId` de la session.

L'application se connecte à la base avec un rôle restreint, soumis à la RLS. Le rôle propriétaire ne sert qu'aux migrations.
Chaque module a un test qui crée deux workspaces et vérifie, au niveau de la base, que l'un ne lit ni n'écrit chez l'autre.

## Alternatives écartées
- Isolation dans le code seul, RLS plus tard — plus rapide, mais un seul oubli de filtre suffit à faire fuiter des données, et activer la RLS sur une base déjà remplie est risqué.
- Une base par compte — isolation maximale, mais migrations et coûts multipliés par le nombre de comptes.

## Conséquences
- Chaque nouvelle table coûte un peu plus : policies + test d'isolation. Le `reviewer` refuse une table sans les deux.
- La façon de transmettre l'identité de l'utilisateur à la base (jeton de l'auth passé à la connexion, ou variable de session dans une transaction) se tranche dans le plan du socle, à partir de la doc Neon « RLS avec Drizzle ».
- Les liens de partage publics (liste de courses) sont le seul accès sans session ; ils passent par un jeton dédié et une policy dédiée.
- L'ouverture multi-comptes ne demande plus de chantier RLS, seulement un audit.
