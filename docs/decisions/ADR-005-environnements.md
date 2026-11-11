# ADR-005 — Démarrer en production seule, staging prêt à brancher

**Date** : 2026-11-10 · **Statut** : accepté

## Contexte
Tant que l'app sert un seul utilisateur, un staging permanent n'apporte rien. Il deviendra nécessaire avec le multi-comptes.

## Décision
Au lancement, deux niveaux :
- **Production** : branche git `main`, projet Vercel en production, branche Neon `main`.
- **Preview** : une URL Vercel et une branche Neon jetable par pull request. C'est là que se font les tests et `/qa`.

Région : Neon et Vercel sont en Europe, à Francfort (projets existants, confirmé par Antoine le 2026-11-11). Tout environnement ajouté reste dans cette région.

Le staging n'est pas créé maintenant, mais rien ne doit empêcher de l'ajouter en une heure : une branche Neon `staging` durable, un environnement Vercel « staging » avec son domaine et ses variables.

## Règles pour rester prêt
- Aucune URL, aucun identifiant d'environnement dans le code : tout passe par des variables d'environnement, listées dans `.env.example`.
- Les migrations s'appliquent par une commande unique, la même pour tous les environnements, lancée au déploiement.
- Les données de départ (seed) sont rejouables sans doublon et ne contiennent aucune donnée personnelle.
- L'auth a une URL par environnement (ADR-003).

## Alternatives écartées
- Staging dès maintenant — un environnement de plus à maintenir et à surveiller pour un seul utilisateur.
- Production seule sans previews — toute erreur de migration toucherait directement les vraies données.

## Conséquences
- Le ticket d'ouverture multi-comptes (BRAIN-26) inclut la création du staging.
- La branche Neon `main` contient les vraies données d'Antoine dès le premier jour : sauvegarde et restauration à vérifier dans le socle.
