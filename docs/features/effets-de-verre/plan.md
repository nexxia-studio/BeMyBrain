# Plan — Effets de verre (BRAIN-33)

**Spec** : `spec.md` · **Branche** : `feat/effets-de-verre` (PR #11, brouillon) · **Créé le** : 2026-11-20

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. [security] = security-auditor après le reviewer. -->

Aucune nouvelle dépendance : GSAP, `@gsap/react` et Motion sont déjà là. Le givre est en CSS pur.

Bascule Privé / Pro : abandonnée par Antoine le 2026-11-20 (aucun effet ajouté).

Valeurs de référence (spec, issues de la démo jouée sur iPhone) :
- **Reflet** :
  - 2,2 s par tuile, 0,16 s de décalage, courbe `sine.inOut` ;
  - `xPercent` de −110 à 110 ;
  - départ 0,1 s après la fin du mouvement de la dernière tuile ;
  - dégradé à 105° : transparent 30 %, `--halo-blue` 55 % à 45 %, `--halo-lilac` 55 % à 55 %, transparent 70 %.
- **Givre** :
  - dégradé à 135°, de `--halo-blue` à `--halo-lilac`, au cran choisi (QA-1) : discret = halos purs, repos 0,55 ; moyen (défaut) = mêlés à 15 % de `--primary`, repos 0,6 ; marqué = à 30 %, repos 0,65 ;
  - opacité de 1 vers le repos du cran, 1,3 s par tuile, 0,18 s de décalage, aucune boucle.

## Tâches
- [x] **1. Amender DESIGN.md pour le reflet et le givre**
  - Fichiers : `DESIGN.md` (§ 7, § 11, et la sous-section des états de chargement si elle existe), `docs/roadmap.md` (ligne BRAIN-33).
  - DESIGN.md :
    - la ligne « Effets de verre » du tableau § 7 devient « Reflet (fin de la révélation) », avec les valeurs ci-dessus ;
    - la phrase « reportés (2026-11-16)… » est retirée ;
    - ajouter « États de chargement — givre », avec les valeurs, « CSS pur », « tuile pleine sans voile » et « mouvement réduit : repos fixe » ;
    - § 11 : préciser qu'un éclaircissement unique n'est pas une boucle.
  - Roadmap : BRAIN-33 en cours, A abandonnée.
  - Test : aucun (docs seules). `tests/design/tokens.test.ts` reste vert.
  - Fini quand : DESIGN.md décrit exactement les valeurs de la spec, sans couleur ni token nouveaux.

- [x] **2. Créer le composant givre (CSS pur)**
  - Fichiers :
    - `src/components/loading/FrostTile.tsx` : composant serveur, sans `"use client"` ;
    - `src/app/globals.css` : utilitaire `frost` et `@keyframes frost-clear`, décalage par `--frost-index` posé en style en ligne (CSP : `style-src-attr` autorisé) ;
    - `src/components/loading/FrostTile.test.tsx` et `tests/design/frost.test.ts`.
  - Props : la classe de la tuile (pour reprendre les dimensions réelles), l'index pour le décalage, et une variante `solid` pour la tuile pleine (couleur primaire, sans voile).
  - Test à écrire d'abord :
    - `FrostTile.test.tsx` :
      - « rend une tuile de verre aria-hidden avec un voile enfant » ;
      - « pose --frost-index » ;
      - « la variante pleine n'a pas de voile ».
    - `tests/design/frost.test.ts`, qui lit `globals.css` :
      - « frost-clear n'anime que opacity » ;
      - « pas d'infinite » ;
      - « fill-mode both » ;
      - « sous prefers-reduced-motion, opacité de repos sans animation » ;
      - « couleurs = var(--halo-blue|--halo-lilac|--popover) seulement » ;
      - « jamais de backdrop-filter dans le voile ».
  - Fini quand : tests verts, lint et types verts, aucun import client.

- [x] **3. Givre au chargement du tableau de bord**
  - Fichiers : `src/app/(app)/dashboard/loading.tsx`, `src/app/(app)/dashboard/loading.test.tsx`.
  - Le titre, `aria-busy` et `role="status"` restent. Les squelettes sont remplacés par la tuile pleine vide puis les tuiles givrées, avec les mêmes classes de taille que `BentoGrid` (`basis`, `grow`, `lg:min-h-75`).
  - Test à écrire d'abord : `loading.test.tsx`.
    - « affiche le titre, un statut chargement et des tuiles givrées » ;
    - « plus aucune ligne de squelette » ;
    - « la tuile pleine n'a pas de voile » ;
    - « les tuiles reprennent les classes de taille de la grille » (comparées aux constantes de `tile-sizes.ts`, pas recopiées).
  - Fini quand : tests verts. Vérification visuelle à 390 et 1440 px (capture locale) : positions identiques au tableau de bord chargé.

- [x] **4. Givre au chargement de la liste et de la corbeille**
  - Fichiers : `src/app/(app)/tasks/loading.tsx` et `.test.tsx`, `src/app/(app)/trash/loading.tsx` et `.test.tsx`.
  - Test à écrire d'abord : dans chaque `loading.test.tsx`, « titre, statut, une tuile givrée à la largeur de la page (max-w-3xl pour /tasks), aucun squelette ».
  - Fini quand : tests verts. Plus aucune occurrence de `skeleton` dans `src/` (grep vide).

- [x] **5. Reflet à la fin de la révélation de la grille**
  - Fichiers :
    - `src/components/bento/TileSurface.tsx` : calque du reflet rendu par React, `aria-hidden`, `pointer-events: none`, hors champ par défaut, `will-change: transform` ; la surface reçoit `relative isolate overflow-hidden` ;
    - `src/components/signature/bento-reveal.tsx` : balayage enchaîné dans le même `playOnce` que la révélation, donc même marqueur de session ;
    - `src/components/signature/bento-reveal.test.tsx` (nouveau, ou `dashboard-entrance.test.tsx`).
  - Le calque est rendu par React plutôt qu'inséré par GSAP : aucune mutation du DOM dans un nœud géré par React.
  - GSAP anime le calque. Motion garde le survol de la `section` : jamais le même élément.
  - Vérifier que `overflow-hidden` ne coupe pas le focus visible des contrôles des tuiles.
  - Test à écrire d'abord :
    - « le balayage démarre après la fin du mouvement de la dernière tuile (position dans la timeline) » ;
    - « seuls les calques des tuiles de verre sont animés, jamais la tuile pleine » ;
    - « n'anime que transform » ;
    - « session déjà jouée : ni révélation ni reflet » ;
    - « mouvement réduit : aucun tween » ;
    - « démontage pendant le balayage : calques revenus hors champ, aucun style laissé ».
  - Fini quand :
    - tests verts ;
    - `tests/build/initial-bundle.test.ts` vert (`pnpm test:build`) ;
    - capture locale à 390 px du reflet en cours.

- [x] **6. Préparer l'essai iPhone dans la démo** [security]
  - Fichiers : `src/app/(app)/demo/effets-de-verre/` :
    - `page.tsx` et `GlassDemo.tsx`, réduits à deux contrôles : le bouton de remise à zéro de session et les liens lents ;
    - `lent/tableau-de-bord/{page,loading}.tsx` et `lent/taches/{page,loading}.tsx` ;
    - tests ;
    - `messages/{fr,en}.json` (`glassDemo`).
  - Le sélecteur A/B/C et `glass-demo-stage.tsx` sont retirés : les effets retenus vivent maintenant dans l'app.
  - Le bouton de remise à zéro efface les marqueurs `sessionStorage` des moments (clés de `signature-keys.ts`), puis ouvre `/dashboard`.
  - Chaque route lente :
    - garde `isGlassDemoEnabled` en premier ;
    - attend 3 s puis rend la vraie page ;
    - son `loading.tsx` réexporte le vrai composant de chargement.
    - Si la page des tâches dépend de son layout (`@detail`), reprendre ce layout plutôt que de dupliquer la page.
  - Pourquoi `[security]` : routes nouvelles qui lisent des données réelles (production copiée sur la preview), derrière une garde d'environnement.
  - Test à écrire d'abord :
    - « 404 en production Vercel et en build hors Vercel, sans lire la session », pour chaque route lente ;
    - « sur preview, lit la session avant le délai » ;
    - « le bouton efface toutes les clés de moments et seulement elles ».
  - Fini quand : tests verts, parité des messages verte, captures locales des deux chargements ralentis.

- [x] **7. Tests e2e : givre sans décalage, reflet une fois par session**
  - Fichiers : `e2e/effets-de-verre.spec.ts`.
  - Le chargement est ralenti par `page.route` : la requête RSC de la navigation côté client est retardée de 2 s. Ce test ne dépend pas de la démo, fermée sous `next start`.
  - Test à écrire :
    - givre (desktop et mobile) :
      - le givre est visible ;
      - `getBoundingClientRect` du titre et de la première tuile identiques avant et après l'arrivée du contenu ;
      - CLS < 0,01 (`PerformanceObserver` `layout-shift`, Chromium) ;
    - reflet :
      - session neuve : un calque de reflet se déplace puis revient hors champ ;
      - navigation aller-retour : aucun tween ;
      - `reducedMotion: "reduce"` : aucun mouvement.
  - Fini quand :
    - verts sur `next start -p <port libre>` avec `E2E_BASE_URL` ;
    - lancés avec `--project=desktop --project=mobile --workers=1` (gotchas) ;
    - aucune régression dans la suite e2e complète.

- [ ] **8. Essai sur l'iPhone d'Antoine (preview, avant /qa)**
  - Session principale :
    - pousse la branche et attend les vérifications de la PR #11 ;
    - donne l'adresse de la démo (connexion Vercel puis compte de production, ADR-010).
  - Antoine vérifie :
    - le reflet dans le vrai tableau de bord, après « remise à zéro » : fluidité, lenteur, une seule fois ;
    - le givre sur les deux chargements ralentis : lisibilité, niveau de repos (question ouverte de la spec), aucun saut à l'arrivée du contenu ;
    - les deux avec « réduire les animations » activé dans iOS.
  - Fini quand : Antoine valide. Chaque retour devient une tâche dans « Corrections QA ».

- [ ] **9. Supprimer la page de démo**
  - Fichiers supprimés :
    - le dossier `src/app/(app)/demo/` entier, tests compris ;
    - la section `glassDemo` de `messages/{fr,en}.json`.
  - Puis `pnpm exec next typegen` (types de routes périmés, voir gotchas).
  - Test à écrire d'abord : `tests/build/no-demo.test.ts`.
    - « aucun fichier sous src/app/(app)/demo » ;
    - « aucune clé glassDemo » ;
    - « aucune référence à isGlassDemoEnabled ni glass-demo dans src/ ».
  - Fini quand : test vert, lint, types et `pnpm test` verts, `/demo/effets-de-verre` en 404 en local. Ensuite `/qa effets-de-verre`.

## Corrections QA
<!-- Alimenté par l'essai iPhone (tâche 8) et /qa. Même format que les tâches. -->
Essai iPhone du 2026-11-21 : reflet validé sans changement. Givre : deux défauts.

- [ ] **QA-1. Givre plus marqué, réglage d'intensité dans la démo**
  - Constat : le voile se voit à peine. Les halos (`#afc0f4`, `#d6c6f2`) mêlés à 75 % de blanc, sur un verre déjà teinté par les mêmes halos, donnent presque rien.
  - Trois crans, tous tirés des tokens de la charte (aucune couleur nouvelle), départ toujours à 1 :
    - discret : halos purs (sans `--popover`), repos 0,55 ;
    - moyen : halos mêlés à 15 % de `--primary`, repos 0,6 ;
    - marqué : halos mêlés à 30 % de `--primary`, repos 0,65.
  - Valeurs portées par des variables CSS (défauts sur `:root`, que `frost` lit sans les redéfinir). Cran par défaut de l'app : moyen, jusqu'au choix d'Antoine.
  - Démo : réglage à trois crans dans `demo/effets-de-verre/layout.tsx`, donc présent pendant le chargement et après, sur les deux pages lentes, sans décaler la page. Le choix va dans un cookie de démo. Le layout le lit et pose les variables en style en ligne sur une enveloppe. Changer de cran recharge la page, ce qui rejoue le givre.
  - Retiré avec la démo à la tâche 9 (cookie compris).
  - Fini quand : tests verts (`tests/design/frost.test.ts` mis à jour), parité des messages, givre visible en capture locale.

- [ ] **QA-2. Tableau de bord : hauteurs fixes par tuile, givre à la géométrie exacte**
  - Pourquoi : largeurs et nombre de tuiles venaient bien de la grille, mais les hauteurs du givre étaient posées au jugé. La hauteur réelle d'une tuile dépendait de son contenu, et l'e2e ne mesurait que le titre et le bord haut de la première tuile. Décision d'Antoine du 2026-11-21 : hauteurs fixes par tuile.
  - Règles d'Antoine :
    - hauteur fixe par taille de tuile (`wide`, `standard`, `figure`) et par tuile pleine « Aujourd'hui », définie **une seule fois**, à côté de `TILE_SIZE_CLASSES` (`src/components/bento/tile-sizes.ts`). Les vraies tuiles et `dashboard/loading.tsx` lisent les mêmes constantes, aucune valeur recopiée (`MOBILE_MIN_HEIGHT` disparaît) ;
    - hauteur calée sur le contenu maximal : Aujourd'hui = 2 pastilles + 3 tâches (`TODAY_TILE_LIMIT`), To-do = 5 tâches (`SIDE_TILE_LIMIT`), tuiles vides = surtitre, titre, espaces, icône et phrase ;
    - dans les tuiles, titres sur une ligne avec points de suspension. Métadonnées des lignes et pastilles d'espaces sur une ligne aussi, sinon la hauteur fixe déborde. Titre complet dans la liste et le détail, inchangés ;
    - le vide d'une tuile peu remplie est comblé par un état conçu, jamais par du blanc. Exemple : « Rien d'autre aujourd'hui » sous les tâches d'Aujourd'hui, un équivalent pour la To-do. Textes FR/EN, charte seulement ;
    - mobile : vérifier que l'écran ne devient pas interminable (hauteur totale à 390 px, avant et après, dans le rapport). Hauteur par largeur d'écran si nécessaire ;
    - DESIGN.md § 6 amendé : hauteurs fixes, valeurs, règle de la ligne unique dans les tuiles, état de remplissage.
  - Fichiers probables : `tile-sizes.ts`, `TodayTile.tsx`, `TodayTaskRow.tsx`, `SideTodoTile.tsx`, `TaskRow.tsx` (variante tuile, sans toucher la liste), `EmptyTile.tsx`, `dashboard/loading.tsx`, `messages/{fr,en}.json`, tests, `e2e/effets-de-verre.spec.ts`, DESIGN.md, spec.
  - Test à écrire d'abord :
    - unitaires : chaque tuile et son givre portent la même classe de hauteur, lue dans `tile-sizes.ts` ; ligne de tuile tronquée sur une ligne ; état de remplissage affiché sous le maximum, absent au maximum ;
    - e2e : boîte (`x`, `y`, `width`, `height`) de **chaque** tuile identique avant (givre) et après (contenu), au pixel, desktop et mobile. Données réalistes : plusieurs tâches, titres longs, tuiles vides et pleines, To-do à 0, 2 et 5 tâches.
  - Fini quand : tests verts, e2e sans écart, suite e2e complète sans régression, captures 390 et 1440 px.

- [ ] **QA-3. Liste et corbeille : givre générique, haut de page immobile**
  - Décision d'Antoine du 2026-11-21 : squelette générique, sans mémorisation, charte de la liste inchangée (titres sur deux lignes).
  - Givre : un en-tête de section, puis six lignes à la hauteur standard d'une ligne dont le titre tient sur une ligne. Toujours les mêmes, aux dimensions de `TaskRow` et de l'en-tête de section de `TaskList`, lues depuis des constantes partagées, sans recopie.
  - En-tête de page, filtre d'espace et interrupteur « Terminées » sont à leur place définitive.
  - La première section et sa première ligne se posent exactement là où était le givre. Un ajustement plus bas dans la liste est accepté. Même règle pour la corbeille (`TaskTrashRow`).
  - Spec : écrire cette règle (ajustement accepté sous la première ligne).
  - Test à écrire d'abord :
    - unitaires : un en-tête et six lignes givrés ;
    - e2e desktop et mobile, avec données réalistes : boîtes de l'en-tête, du filtre, de l'interrupteur, du premier en-tête de section et de la première ligne identiques au pixel ; le bas de la liste n'est pas vérifié.
  - Fini quand : tests verts, suite e2e sans régression.

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
