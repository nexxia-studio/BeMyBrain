# ADR-007 — Rendre l'interface multilingue (français, anglais) dès le socle

**Date** : 2026-11-11 · **Statut** : accepté

## Contexte
BeMyBrain deviendra multi-comptes par abonnement. Extraire après coup des textes écrits en dur dans tous les modules coûte cher.

## Décision
- Français et anglais dès le socle. Aucun texte d'interface en dur : tout est dans `messages/fr.json` et `messages/en.json`.
- Bibliothèque : `next-intl`, en mode « sans routage i18n » (doc officielle vérifiée le 2026-11-11). Pas de préfixe de langue dans l'URL.
- La langue est un réglage de l'utilisateur : colonne `locale` (`text` + CHECK `fr`/`en`) sur `workspace_members`, recopiée dans un cookie lu par `getRequestConfig`. Avant connexion : langue du navigateur, puis français par défaut.
- Dates, nombres et montants formatés par `next-intl` (Intl) selon la langue. Les montants restent en `_cents` jusqu'à l'affichage.
- Le contenu saisi par l'utilisateur n'est jamais traduit.
- Un test échoue si un texte d'interface est écrit en dur dans un `.tsx`, ou si une clé manque dans une des deux langues.

## Alternatives écartées
- Préfixe de langue dans l'URL : utile pour le SEO, sans objet pour une app derrière login.
- `react-i18next` ou bibliothèque maison : moins intégrées aux composants serveur de l'App Router.

## Conséquences
- Une dépendance de plus (`next-intl`). Les fichiers de messages en JSON sont réutilisables par une future app Expo (BRAIN-28).
- Chaque feature livre ses textes dans les deux langues.
