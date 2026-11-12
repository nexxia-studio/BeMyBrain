---
paths:
  - "src/app/**"
  - "src/components/**"
---
# Règles frontend

- Composants : fonction nommée, props typées explicitement, un composant par fichier, nom de fichier = nom du composant en PascalCase.
- Aucune règle métier dans un composant (ADR-008) : elle vit dans `src/modules/`. Aucun import de `@/db/*` ni de `drizzle-orm` dans `src/app/**` ou `src/components/**`. Les données arrivent par les fonctions de `src/modules/<module>/`, appelées côté serveur avec le `workspaceId` de la session.
- Textes : uniquement via `next-intl` (ADR-007), clés dans `messages/fr.json` et `messages/en.json`. Aucun texte en dur dans un `.tsx`, y compris `aria-label`, `title`, `alt`, `placeholder`. Le contenu saisi par l'utilisateur n'est pas traduit.
- UI : shadcn/ui + Tailwind. Couleurs, polices, espacements : tokens définis dans DESIGN.md et déclarés dans `@theme` (Tailwind v4), jamais de valeur arbitraire en dur (`#36f1a6`, `mt-[13px]`).
- Formulaires : validés par zod, le même schéma que côté serveur quand il existe.
- Montants : stockés en `_cents`, formatés seulement à l'affichage par `next-intl` selon la langue. Jamais de float monétaire.
- Animation (ADR-006) : Motion (`motion/react`) pour les interactions et changements d'état ; GSAP pour les moments signature, dans `src/components/signature/`, chargés par `next/dynamic`. Un élément n'est jamais animé par les deux. `prefers-reduced-motion` toujours géré (`useReducedMotion`, `gsap.matchMedia`). Gestes répétés (bascule, filtre, navigation) instantanés : seule la première occurrence d'un moment signature est animée.
- États : chaque écran de liste gère vide / chargement / erreur. Chaque action asynchrone désactive son bouton pendant l'appel.
- Mobile d'abord (ADR-008) : concevoir et vérifier à 390 px avant 1440 px. Navigation au pouce. Zones tactiles ≥ 44 px.
- Tests : Vitest + Testing Library, un fichier `*.test.tsx` à côté du composant pour toute logique conditionnelle. Pas de test de snapshot.
- Session : toute page de `(app)`, toute lecture de données et toute Server Action non publique (`"use server"`) appelle elle-même `requireSession()`. Ne jamais compter sur le layout ni sur le proxy seuls (audit tâche 10).
