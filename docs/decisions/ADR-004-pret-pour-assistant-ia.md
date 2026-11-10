# ADR-004 — Préparer l'assistant IA dès le socle

**Date** : 2026-11-10 · **Statut** : accepté

## Contexte
Antoine veut, plus tard, un assistant qui répond à n'importe quelle question avec accès à toutes ses données.
Un assistant branché après coup sur des données éparpillées ne marche pas.

## Décision
Toutes les données métier vivent dans la base Neon du projet.
Chaque module expose ses lectures dans `src/modules/<module>/queries.ts`, avec des fonctions nommées et typées. L'assistant utilisera ces mêmes fonctions comme outils, en lecture seule, limitées au workspace de la session.

## Alternatives écartées
- Laisser l'assistant écrire ses propres requêtes SQL — risque de fuite entre comptes et de résultats faux.
- Indexer toutes les données dans une base vectorielle dès maintenant — coût et complexité sans besoin prouvé ; à réévaluer pour les notes libres.

## Conséquences
- Une lecture utile à l'écran est écrite une fois et réutilisable par l'assistant.
- Les données restées dans une app tierce sans synchro ne seront pas visibles par l'assistant.
