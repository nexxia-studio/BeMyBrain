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

## Retour de l'essai iPhone (2026-11-24)

Décisions d'Antoine :
- Mise en page : onglets sur mobile (< 768 px), colonnes à défilement horizontal sur tablette et ordinateur. Le réglage de mise en page de la démo disparaît.
- Délai d'appui : moyen, 250 ms. Le réglage du délai disparaît de la démo.

- [x] **D4. Saut du tableau pendant un glisser** — bug vu sur iPhone, mise en page colonnes — 2026-11-24 — `8c6f224` (e2e rouge), `c66f62e`
  - Cause prouvée : l'aimant (`snap-x snap-mandatory`) change chaque petit `scrollBy` du défilement automatique de dnd-kit en saut d'une colonne entière : le tableau file jusqu'au bout en une image (+625 px au doigt, +680 px à la souris, Chromium) et la colonne d'origine sort de l'écran. Même saut reproduit hors React dans Chromium et WebKit. Le recul vu sur iPhone n'est pas reproduit dans Chromium.
  - Correction : défilement horizontal sans aimant ; mise en page par CSS (onglets sous 768 px, colonnes au-delà, même balisage serveur et client), cibles masquées (rectangle vide) retirées des collisions et du clavier, rôles `tabpanel` par `useMediaQuery` ; appui fixé à 250 ms ; réglages de mise en page et de délai retirés.
  - Symptôme (vidéo d'Antoine) : il tire une carte de « En cours » vers « Terminée ». La colonne d'origine disparaît un instant, en-tête compris. Puis le tableau saute horizontalement et la colonne réapparaît décalée. Le défilement horizontal s'emballe pendant le glisser.
  - Piste à confirmer, pas à présumer : le conteneur aimante le défilement (`snap-x snap-mandatory`, `SortableBoard.tsx`), et dnd-kit fait défiler le tableau près des bords. L'aimant ramène le tableau en arrière, les rectangles mesurés au départ deviennent faux, la cible change, la carte change de colonne, et la boucle recommence. Autres causes à écarter : remesure des colonnes, `glass` (backdrop-filter) sur une section déplacée, colonne vidée qui change de taille.
  - Rouge d'abord : un e2e (`e2e/demo-kanban.spec.ts`, à une largeur où toutes les colonnes ne tiennent pas, au doigt par CDP et à la souris) tire une carte de « En cours » vers « Terminée » et échantillonne pendant tout le glisser :
    - `scrollLeft` du tableau : il ne revient jamais en arrière tant qu'on avance, et ne fait aucun aller-retour ;
    - la colonne d'origine : rectangle et en-tête toujours visibles, sans saut horizontal hors du défilement voulu.
  - Correction dans `SortableBoard.tsx` seulement. Même vérification dans la mise en page en onglets : barre d'onglets, panneau, page.
  - Mise en page choisie par la largeur (onglets < 768 px, colonnes au-delà) et délai d'appui fixé à 250 ms ; réglages retirés de la démo, tests à jour.
  - Fin : e2e rouge avant la correction, vert après (desktop et mobile) ; `pnpm test`, `pnpm lint`, `pnpm typecheck` verts.

- [ ] **D5. Tap = détail, appui long = saisie**
  - Tap sur une carte : ouvre le détail dans la même fenêtre que la liste, `TaskDetailSheet` (panneau sur ordinateur, tiroir sur mobile). Contenu : statut, priorité, notes, échéance, tags, sous-tâches.
  - Démo sans base ni action serveur : `TaskDetail` appelle `tasks.update` et ne peut donc pas servir tel quel. Réutiliser la fenêtre et les pastilles qui ne font qu'afficher (`ChoiceChip`, `DueDateChip`, `TagsChip`…), branchées sur l'état local de la démo. Aucun appel au registre d'actions. Si `TaskDetailSheet` impose une navigation à la fermeture, ajouter une fermeture par rappel sans changer le comportement actuel, testée.
  - Les gestes ne se confondent jamais :
    - un tap n'est un tap que si le doigt se lève avant le délai d'appui, sans avoir bougé au-delà de la tolérance ;
    - une saisie, un défilement ou un glisser n'ouvre jamais le détail ;
    - au clavier : Entrée ouvre le détail, Espace saisit la carte (dnd-kit).
  - API de `SortableBoard` : `onOpen(id)`, toujours générique.
  - Tests : unitaires (Vitest) sur le tap, le glisser, le défilement, Entrée et Espace ; e2e au doigt par CDP (tap court = détail, appui de 250 ms et plus = saisie sans détail).
  - Fin : tests, lint, typecheck verts.

- [ ] **D6. Effet de saisie et survol**
  - Appui long : la carte se soulève, inclinée d'environ 2°, avec une ombre marquée. Pendant le déplacement, une empreinte estompée reste à sa place d'origine.
  - Couleurs, verre et ombres de DESIGN.md seulement. Animation par Motion (ADR-006).
  - `prefers-reduced-motion` : aucune inclinaison, aucune animation de soulèvement, l'empreinte reste.
  - Ordinateur (pointeur fin et survol) : curseur main ouverte et léger relief au survol, main fermée pendant le glisser. Rien de tout cela au doigt.
  - Tests : état de la carte en glisser (inclinaison, empreinte), mouvement réduit (aucune inclinaison) ; e2e : console propre et curseur `grab` au survol sur ordinateur.
  - Fin : tests, lint, typecheck verts ; anti-slop de `nexxia-design` passé.

Retrait : la dernière tâche de `plan.md` supprime `/demo/kanban`, ses messages et ses fixtures (`SortableBoard` reste), et vide la liste `ALLOWED_DEMOS` de `tests/build/no-demo.test.ts` (`pnpm test:build` refuse alors toute démo).
