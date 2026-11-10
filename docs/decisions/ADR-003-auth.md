# ADR-003 — Utiliser l'auth gérée de Neon (Managed Better Auth)

**Date** : 2026-11-10 · **Statut** : accepté — doc Neon vérifiée le 2026-11-10

## Contexte
Neon ne remplace pas Supabase Auth à l'identique. Il faut une connexion simple en V1 (un compte) qui tienne en multi-comptes, et qui s'accorde avec la RLS (ADR-002).

## Décision
La connexion passe par Managed Better Auth, le service d'auth de Neon construit sur Better Auth.
Ce que dit la doc Neon à cette date :
- Utilisateurs et sessions sont stockés dans la base du projet (schéma `neon_auth`), utilisables dans les policies RLS.
- Chaque branche de base a son propre environnement d'auth : preview, staging et production ne partagent pas leurs utilisateurs.
- Inclus dans la formule gratuite jusqu'à 60 000 utilisateurs actifs par mois.
- Connexion par e-mail et mot de passe, code par e-mail, lien magique, Google, GitHub, Apple, Microsoft.

## Limites connues
- **Double authentification (MFA) : pas encore disponible**, annoncée « bientôt ». À revérifier avant de brancher la banque (BRAIN-13) et avant le multi-comptes.
- Plugin Organisations : prise en charge partielle. On ne s'appuie pas dessus : les comptes sont nos propres tables `workspaces` et `workspace_members`.
- Jeu de fonctionnalités fixe : pas de plugin Better Auth sur mesure.

## Alternatives écartées
- Better Auth installé dans l'app — toutes les options (dont la double authentification), mais serveur d'auth, migrations et mises à jour à notre charge.
- Clerk — très rapide à brancher, mais les utilisateurs vivent hors de la base et le prix monte avec les comptes.

## Conséquences
- Porte de sortie : si la double authentification manque le moment venu, on passe à Better Auth installé dans l'app. Même base technique, donc migration limitée.
- Les jetons d'une branche ne valent pas sur une autre : chaque environnement a son URL d'auth dans ses variables.
