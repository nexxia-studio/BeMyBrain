# ADR-006 — Animer avec Motion pour l'interface, GSAP pour les moments signature

**Date** : 2026-11-11 · **Statut** : accepté (remplace « GSAP seul » de la spec du socle)

## Contexte
La spec du socle imposait GSAP seul. Le § 5 de `nexxia-design` prévoit Motion pour React / Next, et GSAP seulement pour pin, scrub et défilement horizontal. Antoine veut des moments signature soignés sans alourdir les interactions courantes.

## Décision
- **Motion** (`motion/react`) : interactions et changements d'état (survol, ouverture, apparition d'un élément, transitions de liste).
- **GSAP** : moments signature seulement — entrée du tableau de bord, révélation de la grille bento, effets de verre, bascule Privé / Pro, écrans vides. Dans des composants dédiés (`src/components/signature/`), chargés à la demande (`next/dynamic`).
- États de chargement (givre, BRAIN-33, 2026-11-20) : keyframes CSS seulement, ni Motion ni GSAP, pour s'afficher avant le JavaScript.
- Un élément n'est jamais animé par les deux bibliothèques.
- `prefers-reduced-motion` toujours respecté (Motion : `useReducedMotion` ; GSAP : `gsap.matchMedia`). Les gestes répétés (bascule, filtre, navigation) restent instantanés : seule la première occurrence d'un moment signature est animée.

## Écart assumé
Au § 5 de `nexxia-design` : GSAP sert ici à des moments signature, pas seulement à pin, scrub ou défilement horizontal.

## Exception : survol des cartes déplaçables (2026-11-27)
Le survol d'une carte du tableau des tâches (contour `input`, `shadow-glass`, translation de 2 px) est écrit en CSS (`:hover`), sans Motion. Cause : `whileHover` de Motion se termine avant le `mouseup` de dnd-kit et laisse la carte montée de 2 px après un glisser à la souris. Règle : aucun composant d'animation Motion ou GSAP dans une carte déplaçable. Décision d'Antoine après l'essai iPhone du tableau réel (BRAIN-46).

## Alternatives écartées
- GSAP seul : lourd pour les micro-interactions React, et en contradiction avec `nexxia-design`.
- Motion seul : moins de contrôle sur des séquences chorégraphiées.

## Conséquences
- Deux dépendances d'animation ; GSAP hors du bundle initial.
- Le `reviewer` refuse un élément animé par les deux, ou une animation sans repli pour `prefers-reduced-motion`.
- `tw-animate-css` (apporté par shadcn) reste limité aux animations d'entrée/sortie des primitives de `src/components/ui/` ; jamais sur un élément animé par Motion ou GSAP.
