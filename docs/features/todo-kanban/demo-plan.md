# Démo kanban (BRAIN-46) — plan court

But : juger au doigt, sur iPhone, le glisser-déposer du kanban avant d'écrire `spec.md`. Même modèle que la démo des effets de verre (`git show 3411c25`, `508988b`) : page fermée en production, retirée à la dernière tâche de `plan.md`.

Décisions d'Antoine (2026-11-24) :
- Bibliothèque : dnd-kit classique (`@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/utilities` 3.2.2). Justification : sur iPhone, le glisser ne démarre qu'après un appui, ce qui garde le défilement ; la carte suit le doigt ; défilement automatique près des bords ; clavier et lecteur d'écran gérés. Alternatives écartées : Pragmatic DnD (glisser natif, déclenchement et aperçu imposés par iOS), sans bibliothèque (environ 500 lignes de détection, défilement et accessibilité à maintenir). Pairs : `react >=16.8`, aucune alerte de sécurité connue (GitHub Advisory, `pnpm audit`, 2026-11-24). Déjà ajoutée par la session principale (`package.json`, `pnpm-lock.yaml`, non committés).
- Isolement : dnd-kit n'est importé que par un seul composant à nous, `src/components/kanban/SortableBoard.tsx`. Règle eslint qui interdit `@dnd-kit/*` partout ailleurs, tests compris.
- Mobile : deux mises en page, colonnes à défilement horizontal ou une colonne à la fois avec onglets (dépôt sur un onglet = changement de colonne).
- Mise à jour optimiste, exception limitée au déplacement : la carte reste où elle est lâchée ; échec → retour animé à sa place + « Déplacement non enregistré » avec Réessayer.
- Terminée : affichée, 20 plus récentes + « Tout voir ». Annulée : bandeau replié avec compteur, on peut y déposer.

Risque connu : `useUniqueId` de dnd-kit (compteur de module) donne des `aria-describedby` différents entre serveur et client → avertissement d'hydratation. Parade : `id` stable (`useId()`) passé à `DndContext`. Critère : aucun avertissement ni erreur en console, hydratation comprise.

## Tâches

- [x] **D1. Composant `SortableBoard` et verrou d'import** — 2026-11-24 — `ac27662`, `0cdf05a`, `67ee7de`
  - Fichiers : `package.json`, `pnpm-lock.yaml` (déjà modifiés), `src/components/kanban/SortableBoard.tsx` (+ test), `eslint.config.mjs` (+ test de la règle, sur le modèle des tests de frontières existants).
  - API générique, sans rien de spécifique aux tâches : colonnes (id, libellé, éléments ordonnés, repliée ou non), `renderCard`, `onMove({ id, toColumn, beforeId, afterId })`, `activationDelayMs`, `layout: "scroll" | "tabs"`, onglets cibles de dépôt en mode `tabs`. `DragOverlay`, capteurs pointeur/tactile (délai + tolérance) et clavier, annonces FR/EN via next-intl, `id` de `DndContext` stable (`useId`).
  - Tests : réordonnancement et changement de colonne au clavier (jsdom), `onMove` reçoit les bons voisins, rendu serveur puis hydratation sans avertissement (`renderToString` + `hydrateRoot`, console espionnée), règle eslint qui refuse `@dnd-kit/core` hors de `SortableBoard.tsx`.
  - Fin : `pnpm test`, `pnpm lint`, `pnpm typecheck` verts.

- [x] **D2. Page `/demo/kanban`** `[security]` — 2026-11-24 — `f8f75b4`, `523aab2`, `d7bc195`
  - Fichiers : `src/app/(app)/demo/kanban/` (layout de garde, page, `KanbanDemo.tsx`, `demo-fixtures.ts`, tests), `messages/{fr,en}.json`.
  - Garde dans un `layout.tsx` (leçon `508988b`) : 404 en production Vercel et sur tout build de production hors Vercel, ouverte en preview et en dev ; session exigée ensuite. Aucune base, aucune action serveur : tâches fictives en mémoire.
  - Données : 5 colonnes ; une quinzaine de cartes dans « À faire » ; titres courts et longs (deux lignes) ; pastilles d'espace, tags, priorités, échéances (en retard, aujourd'hui, plus tard) ; quelques cartes « Bloquée ». Terminée : plus de 20 cartes pour montrer « Tout voir ». Annulée repliée.
  - Réglages : mise en page (défilement / onglets), délai d'appui (court 150 ms, moyen 250 ms, long 400 ms), latence simulée (0, 1 s, 3 s), « Faire échouer le prochain dépôt ».
  - Charte : couleurs, verre (`rounded-tile`) et givre de DESIGN.md uniquement ; Motion pour le retour en arrière (ADR-006) ; `prefers-reduced-motion` respecté.
  - Tests : garde (404 production Vercel, 404 build hors Vercel, ouverte en preview, sans lecture de session avant la garde), dépôt optimiste puis retour en arrière à l'échec simulé, textes FR/EN sans texte en dur.
  - Fin : tests, lint, typecheck verts ; anti-slop de `nexxia-design` passé.

- [x] **D3. Vérification navigateur et preview** — 2026-11-24 — `7f79d75`, `2938b41`, `89a2fb2`, `7b52736` — PR #14 en brouillon
  - Fichiers : `e2e/demo-kanban.spec.ts`.
  - e2e (desktop et mobile) : page chargée sans message de console de niveau avertissement ou erreur (hydratation comprise), glisser d'une carte entre deux colonnes à la souris, changement de colonne par onglet en mobile.
  - Fin : e2e de la démo verts sous `pnpm dev` (la garde ferme la page sur tout build de production hors Vercel) ; 404 vérifié sur un build de production (`e2e/demo-kanban-fermee.spec.ts`, lancé seul contre `pnpm build && next start`) ; PR en brouillon ouverte, preview prête.
  - 404 sur build de production : 2026-11-24, `pnpm build && next start -p 3100`, `e2e/demo-kanban-fermee.spec.ts` 1 passé (`/demo/kanban` 404, `/tasks` 200, même session).

Retrait : la dernière tâche de `plan.md` supprime `/demo/kanban`, ses messages et ses fixtures (`SortableBoard` reste), et vide la liste `ALLOWED_DEMOS` de `tests/build/no-demo.test.ts` (`pnpm test:build` refuse alors toute démo).
