# ADR-008 — Livrer une web app installable (PWA), conçue mobile d'abord

**Date** : 2026-11-11 · **Statut** : accepté

## Contexte
Antoine utilisera BeMyBrain surtout au téléphone. Une app native Expo est envisagée plus tard (BRAIN-28), si l'usage le justifie.

## Décision
- Chaque écran est conçu mobile d'abord (390 px avant 1440 px), navigation au pouce, zones tactiles ≥ 44 px.
- L'app est installable sur l'écran d'accueil iOS et Android dès le socle : manifeste natif de Next.js (`src/app/manifest.ts`), icônes, métadonnées Apple, affichage `standalone`.
- Pas de mode hors ligne dans le socle, donc pas de bibliothèque de service worker. À rouvrir si un module en a besoin.
- Pour ne pas fermer la porte à Expo : la logique métier vit dans `src/modules/` (fonctions sans dépendance à React ni à Next), jamais dans les composants. Les textes sont en JSON (ADR-007).

## Alternatives écartées
- App native dès maintenant : deuxième base de code avant d'avoir un usage réel.
- Serwist ou next-pwa dès le socle : dépendance sans besoin hors ligne prouvé.

## Conséquences
- Le `reviewer` refuse une règle métier écrite dans un composant.
- BRAIN-28 démarrera d'une logique déjà séparée de l'interface ; l'exposition des modules par une API reste à faire à ce moment-là.
