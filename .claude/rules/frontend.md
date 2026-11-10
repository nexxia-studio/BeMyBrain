---
paths:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "app/**"
---
# Règles frontend

<!-- Écrit pour le profil React + Vite + Supabase. Pour Astro (site vitrine) : garder UI, montants, états, mobile, supprimer TanStack/Supabase. Pour Expo : remplacer Tailwind/shadcn par les composants RN du projet. -->

- Composants : fonction nommée, props typées explicitement, un composant par fichier, nom de fichier = nom du composant en PascalCase.
- Données serveur : TanStack Query uniquement (`useQuery` / `useMutation`), clés de query centralisées dans `src/lib/queryKeys.ts`. Pas de `useEffect` + `fetch`.
- Supabase côté client : via `src/lib/supabase.ts`, jamais instancié ailleurs. Types générés depuis `src/types/database.ts`, pas de `any`.
- UI : shadcn/ui + Tailwind. Couleurs, polices, espacements : tokens définis dans DESIGN.md et déclarés dans `@theme` (Tailwind v4), jamais de valeur arbitraire en dur (`#36f1a6`, `mt-[13px]`).
- Formulaires : react-hook-form + zod, le même schéma zod que côté serveur quand il existe.
- Montants : stocker en cents, formater à l'affichage avec `formatCents()` (`src/lib/money.ts`), locale `fr-BE`.
- États : chaque écran de liste gère vide / chargement / erreur. Chaque action asynchrone désactive son bouton pendant l'appel.
- Mobile d'abord : vérifier à 390 px avant 1440 px. Zones tactiles ≥ 44 px.
- Tests : Vitest + Testing Library, un fichier `*.test.tsx` à côté du composant pour toute logique conditionnelle. Pas de test de snapshot.
