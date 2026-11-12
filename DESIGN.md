# DESIGN — BeMyBrain

Charte visuelle, source unique de vérité. Contexte produit : `PRODUCT.md`. Tokens implémentés dans `src/app/globals.css` (verrouillés par `tests/design/tokens.test.ts`).

**Statut** : brouillon du 2026-11-12, à valider par Antoine (tâche 12 du socle).
**Référence validée** (thème clair) : `docs/design/references/dashboard-desktop.dc.html` (1440 px) et `dashboard-mobile.dc.html` (390 px). Inspiration d'origine, secondaire : `finance-glass.webp`, `maison-bento.webp`.
**Méthode** : skill `nexxia-design`. Impeccable n'est pas installé dans l'environnement de rédaction : ce fichier en suit l'esprit (charte unique, tokens nommés, composants, interdits), à repasser par `/impeccable document` quand il le sera.

## 1. Lecture et curseurs
Tableau de bord personnel · Antoine puis abonnés, surtout au téléphone · calme, lumineux, net · Next.js + Tailwind v4 + shadcn/ui (base-nova) personnalisé.

| Écran | VARIANCE | MOTION | DENSITY | Pourquoi |
| --- | --- | --- | --- | --- |
| Tableau de bord et coque | 4 | 5 | 5 | Preset « App SaaS » (4 / 3 / 6) : MOTION +2 pour les moments signature (ADR-006), DENSITY −1 pour le mobile (preset Dopamine). |
| Connexion, réinitialisation, erreurs | 2 | 1 | 3 | Une colonne, aucune distraction. |

Verrous : thème clair (un seul, jamais inversé entre sections) · un accent, l'indigo · une famille de gris, l'encre bleutée · rayons doux + pilule · icônes Lucide (déjà fournie par shadcn) trait 2, bouts arrondis, 20–22 px · Motion pour les interactions, GSAP pour les moments signature (ADR-006).

## 2. Couleurs
Toutes viennent de la référence. Aucune autre couleur n'entre sans passer par ce fichier. Les composants n'utilisent que les tokens sémantiques (`bg-primary`, `text-muted-foreground`, `bg-glass`…), jamais la palette brute : c'est ce qui permettra le thème sombre.

### Palette (brute, dans `:root`)
| Nom | Valeur | Rôle dans la référence |
| --- | --- | --- |
| `--mist` | `#E8ECF5` | Fond brume bleu-lilas |
| `--halo-blue` | `#AFC0F4` | Halo flou, haut gauche |
| `--halo-lilac` | `#D6C6F2` | Halo flou, droite |
| `--halo-aqua` | `#BCE2EC` | Halo flou, bas (ordinateur seulement) |
| `--ink` | `#1B2033` | Texte principal |
| `--ink-muted` | `#535A72` | Texte secondaire, surtitres, onglets inactifs |
| `--indigo` | `#3D4FD6` | Accent : tuile « Aujourd'hui », bouton d'ajout, barres de progression, cases cochées |
| `--indigo-deep` | `#2B3AA8` | Liens, onglet actif, texte de la pastille Nexxia |
| `--ember` | `#8A3810` | Texte chaud : pastille Trustup, écart au-dessus de la cible |
| `--ember-soft` | `#E8743B` | Fond de la pastille Trustup (à 16 %) |
| `--white` | `#FFFFFF` | Texte sur indigo, pilule active, élément actif de la barre latérale |
| teinte d'ombre | `rgb(38 48 92)` | Ombres bleutées (jamais noires) |

La finance définira ses propres couleurs « positif » et « négatif », à sa spec. La braise ne sert pas à cet usage.

### Tokens sémantiques et contrastes
Contrastes WCAG calculés sur le cas le plus défavorable. Pour le verre : verre posé sur le cœur du halo bleu, mobile ou ordinateur. Pour le fond nu (« cœur du halo ») : cœur du halo bleu mobile, à 90 % sur la brume ; le cœur du halo lilas mobile (85 %) est donné quand il compte. Exigences : texte 4,5:1 ; grand texte, icônes et éléments d'interface 3:1.

| Token (Tailwind) | Valeur | Usage | Contraste |
| --- | --- | --- | --- |
| `background` | `--mist` | Fond de page | — |
| `foreground` | `--ink` | Texte principal | 13,6 sur brume ; ≥ 12,97 sur verre ; 9,38 sur le cœur du halo ; 16,1 sur blanc |
| `muted-foreground` | `--ink-muted` | Texte secondaire, surtitres | 5,77 sur brume ; ≥ 5,49 sur verre ; 6,83 sur blanc ; **3,97 sur le cœur du halo bleu et 4,50 (au seuil) sur le cœur du halo lilas, sans verre : interdit** |
| `primary` / `primary-foreground` | `--indigo` / `--white` | Tuile « Aujourd'hui », bouton principal, bouton d'ajout | blanc sur indigo 6,39 |
| `primary-hover` | `--indigo-deep` | Survol du bouton principal (dérivé : l'indigo profond de la référence) | blanc sur indigo profond 9,24 |
| `on-primary-muted` | blanc 86 % | Date et surtitre sur la tuile pleine | 5,18 |
| `on-primary-lead` | blanc 90 % | Phrase d'intro de la tuile pleine | 5,51 |
| `on-primary-surface` / `on-primary-border` | blanc 16 % / 28 % | Pastilles de chiffres dans la tuile pleine | libellé en blanc plein : 4,56 (voir § 8, décision 3) |
| `link` / `link-hover` | `--indigo-deep` / `--ink` | Liens (« Tout voir ») | ≥ 7,42 sur verre ; 5,37 sur le cœur du halo |
| `ring` | `--indigo` | Anneau de focus, 2 px, décalé de 2 px | 5,40 sur brume ; ≥ 5,13 sur verre ; 3,71 sur le cœur du halo (≥ 3:1) |
| `ring-on-primary` | `--white` | Focus sur la tuile pleine | 6,39 |
| `destructive` | `--ember` | Erreurs de formulaire, actions destructives (dérivé, § 8) | ≥ 6,36 sur verre ; 7,91 sur blanc ; 4,60 sur le cœur du halo |
| `input` | `--ink-muted` | Bordure des champs (dérivé, § 8) | ≥ 5,49 sur verre ; 3,97 sur le cœur du halo (≥ 3:1) |
| `border` | encre 12 % | Séparateurs, contour du champ de recherche | décoratif (1,26), ne porte aucune information |
| `glass` / `glass-border` | blanc 58 % mobile, 56 % ordinateur / blanc 75 % | Tuiles, en-tête, barre latérale, barre d'onglets | bord décoratif |
| `row` (= `card`) | blanc 50 % | Ligne de liste dans une tuile ; `card` de shadcn pointe ici, une carte se posant dans une tuile en verre | encre ≥ 14,5 ; secondaire ≥ 6,14 |
| `track` | encre 9 % | Piste des barres de progression | indigo sur piste ≥ 4,33 |
| `pill-track` | encre 7 % | Piste de la bascule Privé / Pro | secondaire 5,06 sur brume ; 4,82 sur verre |
| `accent` / `secondary` | blanc 55 % / blanc 60 % | Survol d'un élément de liste ; bouton secondaire | encre ≥ 12 |
| `sidebar` | `--glass-bg` (bord `glass-border`, actif blanc, anneau indigo) | Barre latérale : surface en verre de premier niveau, posée sur le fond | comme le verre |
| `popover` | `--white` | Menus, palette : opaques (jamais de verre sur du verre) | encre 16,1 |
| `chip-neutral` | encre 8 % + `--ink` | Pastille Privé | ≥ 11,16 |
| `chip-warm` | braise claire 16 % + `--ember` | Pastille Trustup | ≥ 5,52 |
| `chip-indigo` | indigo 13 % + `--indigo-deep` | Pastille Nexxia | ≥ 6,21 |
| `chart-1` à `chart-5` | indigo, indigo profond, braise claire, encre secondaire, encre | Provisoire, à fixer au premier graphique | — |

États dérivés : survol d'un élément de liste ou de navigation = `accent` (le fond « ouvert » de la référence) ; élément actif = blanc + `shadow-raised` ; pression = `scale(0.97)` ; désactivé = opacité 60 % et `cursor: not-allowed` (exempté de contraste par WCAG, mais le libellé reste lisible). La couleur d'une pastille de contexte (neutre, chaude, indigo) est attribuée par contexte ; quand les contextes deviendront configurables, la couleur sera choisie parmi ces trois, jamais saisie.

## 3. Typographie
Inter pour le texte, Space Grotesk pour les titres et les chiffres, toutes deux par `next/font/google` (variables `--font-inter`, `--font-space-grotesk` ; utilitaires `font-sans`, `font-heading`). Graisses : 400, 500, 600 ; jamais 700. `h1`–`h3` prennent Space Grotesk par défaut.

| Token | Taille 390 → 1440 px | Interligne | Police, graisse | Usage |
| --- | --- | --- | --- | --- |
| `text-display` | 30 → 40 px (fluide) | 1,1 | Space Grotesk 600 | « Bonjour Antoine. » de la tuile pleine |
| `text-section` | 22 (dérivé) → 26 px | 1,2 (dérivé) | Space Grotesk 600 | Titre de groupe de tuiles (« Budget, placements et patrimoine ») |
| `text-title` | 21 px | 1,25 (dérivé) | Space Grotesk 600 | Titre de tuile ; 20 px pour une petite tuile |
| `text-figure` | 34 → 46 px | 1 | Space Grotesk 600 | Chiffre clé d'une tuile (« 3 », « 52 % ») |
| `text-stat` | 28 px | 1,1 | Space Grotesk 600 | Chiffres de la tuile pleine |
| `text-brand` | 20 px | 1,2 (dérivé) | Space Grotesk 600 | Nom « BeMyBrain » |
| `text-lead` | 15 → 16 px | 1,5 | Inter 400 | Phrase d'intro de la tuile pleine (`text-on-primary-lead`) |
| `text-body` | 15 px | 1,5 | Inter 400 | Corps, lignes de liste, boutons (600) |
| `text-small` | 14 px | 1,45 (dérivé) | Inter 400 / 500 | Libellés secondaires, liens d'action (600), sous-catégories (500) |
| `text-caption` | 13 px | 1,4 (dérivé) | Inter 400 | Échéances, notes de bas de tuile |
| `text-eyebrow` | 12 → 13 px | 1,3 (dérivé) | Inter 600, capitales, +0,06 em | Surtitre de tuile (nom du module) |
| `text-chip` | 12 px | 1,3 (dérivé) | Inter 600 | Pastilles de contexte |
| `text-tab` | 11 px | 1,2 (dérivé) | Inter 600 | Libellés de la barre d'onglets mobile |

« Dérivé » : la référence ne fixe pas l'interligne (valeur navigateur) ou ne montre pas la taille mobile ; valeur choisie ici, à valider avec le reste.
Champs de formulaire : 16 px (`text-base`), sinon Safari iOS zoome au focus.
FR et EN : le français est 15 à 30 % plus long. Aucune largeur fixe sur un libellé ; les titres passent sur deux lignes plutôt que d'être tronqués ; `hyphens: auto` sur les paragraphes (posé en base dans `globals.css`, suit `<html lang>`) ; onglets mobiles : un mot par langue, vérifié dans les deux (« Paramètres » / « Settings »). Corps ≤ 65 caractères par ligne.

## 4. Rayons, ombres, verre, calques
**Rayons** (doux + pilule, un seul système) : `rounded-sm` 8 px (touche ⌘K) · `rounded-md` 12 px (sous-catégorie) · `rounded-lg` 14 px (ligne de liste, élément de navigation, logo, champ, bouton rectangulaire) · `rounded-xl` 20 px (pastille de chiffre) · `rounded-tile` 24 px mobile / 28 px ordinateur (tuiles, en-tête, barre latérale) · `rounded-bar` 30 px (barre d'onglets) · `rounded-full` (pilules, boutons ronds, pastilles, barres de progression). Ce sont les seuls rayons : les défauts de Tailwind (`rounded-2xl`, `3xl`, `4xl`…) sont retirés du thème (`--radius-*: initial`).

**Ombres** (toujours bleutées) : `shadow-glass` `0 8px 28px` mobile / `0 10px 36px` ordinateur, teinte d'ombre à 9 % · `shadow-today` `0 14px 34px` / `0 18px 44px`, indigo à 28 % · `shadow-raised` `0 2px 8px`, teinte d'ombre à 14 % (pilule active, élément actif ; dérivé : la référence met 12 % sur l'élément actif de la barre latérale, unifié à 14 %) · `shadow-fab` `0 8px 20px`, indigo à 35 % (bouton d'ajout mobile).

**Verre** (`glass`, utilitaire de `globals.css`) : fond blanc 58 % (mobile) / 56 % (ordinateur), `backdrop-filter: blur(24px | 26px) saturate(150%)`, bord 1 px blanc 75 %, `shadow-glass`. Règles : jamais deux verres empilés (une ligne dans une tuile est `row`, pas du verre ; menus et palette sont opaques) ; `prefers-reduced-transparency` → fond opaque de même teinte, sans flou.

**Fond** : brume `--mist` + halos en dégradés radiaux fixes (`body::before`, aucune image) ; mobile : bleu en haut à gauche, lilas à droite ; ordinateur : + aqua en bas. Le texte secondaire ne se pose jamais directement sur le cœur d'un halo (voir contrastes).

**Calques** (`z-(--z-…)`) : `--z-halo` −1 · `--z-content` 1 · `--z-header` 10 · `--z-tabbar` 20 · `--z-overlay` 40 · `--z-dialog` 50 · `--z-toast` 60.

**Espacements** (base Tailwind 4 px, plus) : `gap-grid` 14 / 16 / 20 px (mobile / tablette / ordinateur) · `p-tile` 18 / 24 px · `p-today` 22 / 28 px · `px-page` 16 / 24 px / `clamp(14px, 2.4vw, 36px)` · largeur max du contenu 1400 px.

## 5. Composants de base
Sourcing : primitives shadcn/ui (base-nova) réalignées sur ces tokens, sinon composants maison dans `src/components/`. Un composant importé est relu contre ce fichier.

- **Tuile verre** (`section`) : `glass rounded-tile p-tile`, colonne, `gap-4`. En-tête : surtitre (`text-eyebrow text-muted-foreground`) + titre (`text-title`), lien d'action à droite (`text-small font-semibold text-link`, zone ≥ 44 px par padding). Contenu : lignes `row rounded-lg min-h-11 px-3.5`, `text-body`. Note de bas en `text-caption text-muted-foreground`, poussée en bas. Hauteur minimale par rangée (300 / 320 / 230 px dans la référence) pour aligner une rangée.
- **Tuile « Aujourd'hui »** : la seule tuile pleine de l'app. `bg-primary text-primary-foreground shadow-today rounded-tile p-today`. Date en surtitre (`on-primary-muted`), salutation en `text-display`, intro en `text-lead text-on-primary-lead`, puis pastilles de chiffres (`on-primary-surface`, bord `on-primary-border`, `rounded-xl`, chiffre en `text-stat`, libellé `text-small` **en blanc plein**). Focus dedans : `ring-on-primary`.
- **Pilule de bascule Privé / Pro** : `role="group"` + `aria-label`, deux boutons `aria-pressed`. Piste `bg-pill-track rounded-full p-1 gap-1` ; bouton `min-h-11 rounded-full text-body font-semibold`, padding horizontal 18 px (mobile) / 22 px (ordinateur) ; actif : fond blanc, `text-foreground`, `shadow-raised` ; inactif : transparent, `text-muted-foreground`. Toujours en haut : dans l'en-tête en verre (ordinateur), en haut à droite à côté du nom (mobile).
- **En-tête (ordinateur)** : verre, `rounded-tile`, `px-4 py-3`, ≤ 68 px de haut : logo (carré indigo 40 px, `rounded-lg`, glyphe blanc) + nom, pilule au centre, recherche « Chercher ou ajouter ⌘K » (bouton secondaire pilule, bord `border`) et bouton d'ajout rond 44 px indigo.
- **Barre latérale (ordinateur)** : verre, `rounded-tile`, `p-3.5`, largeur ≥ 240 px, alignée en haut. Titre du côté (« Vie privée » / « Vie pro ») en surtitre. Catégorie = bouton `min-h-11 px-3.5 rounded-lg text-body font-semibold`, chevron 16 px à droite (`text-muted-foreground`, pivote de 90° ouvert), `aria-expanded`. Actif : fond blanc + `shadow-raised` ; ouvert : `accent`. Sous-catégories : liens `min-h-11 px-3.5 rounded-md text-small font-medium text-muted-foreground`, retrait de 18 px. Les catégories suivent le côté actif.
- **Barre d'onglets (mobile)** : verre, flottante, `rounded-bar`, `px-2.5 py-2`, à 16 px des bords, `bottom: max(26px, env(safe-area-inset-bottom) + 8px)`, `z-(--z-tabbar)`. Quatre onglets (`min-h-13`, icône 22 px au-dessus d'un `text-tab`) : actif `text-link`, inactifs `text-muted-foreground`, `aria-current="page"` sur l'actif. Au centre, bouton d'ajout rond 56 px, `bg-primary`, `shadow-fab`, icône + 24 px trait 2,4. Le contenu réserve sa hauteur en bas (≈ 68 px + décalage + 16 px).
- **Boutons** : principal `bg-primary text-primary-foreground hover:bg-primary-hover` ; secondaire `bg-secondary border border-border text-secondary-foreground` ; discret (lien d'action) `text-link`. Hauteur ≥ 44 px, `text-body font-semibold`, `rounded-full` dans la coque (comme la référence), `rounded-lg` pour un bouton pleine largeur de formulaire. Pendant un appel : désactivé, libellé d'attente.
- **Champs** : libellé visible au-dessus (`text-small font-medium`), jamais le placeholder comme libellé. `min-h-11 rounded-lg border border-input bg-row px-3 text-base`. Erreur sous le champ, `text-destructive`, reliée par `aria-describedby`.
- **Cases à cocher** : 18 px, `accent-color: primary`, ligne entière cliquable (`label` `min-h-11`).
- **Barres de progression** : piste `bg-track h-2.5 rounded-full`, remplissage `bg-primary` ; elles portent une donnée, jamais décoratives.
- **Pastilles de contexte** : `rounded-full px-2.5 py-0.5 text-chip`, couleurs `chip-*`.
- **Focus visible** : partout `outline 2px ring` décalé de 2 px (posé en base dans `globals.css`) ; sur la tuile pleine, `ring-on-primary`. Les primitives shadcn qui utilisent `ring-ring/50` passent à `ring-ring` plein (50 % tombe sous 3:1).

## 6. Grille bento et navigation
Mécanique de la référence : rangées `flex flex-wrap gap-grid`, chaque tuile `min-w-0` avec une base de largeur, ce qui donne une colonne au téléphone sans point de rupture.

| Type de tuile | Base (`flex`) | Exemple |
| --- | --- | --- |
| Large | `2 1 400px` | Aujourd'hui, To-do, Budget |
| Standard | `1 1 240px` (220–260 selon le contenu) | Courses, Assurances |
| Chiffre | `1 1 140px` | Paire « Courses 3 » / « Budget 52 % » sur mobile |

- **390 px** : une colonne de tuiles ; seule une paire de tuiles « chiffre » partage une rangée (référence mobile). Coque : nom + pilule en haut, barre d'onglets en bas. `px-page` 16 px.
- **640–1023 px (tablette)** : deux tuiles standard par rangée, les larges sur toute la largeur ; navigation encore en barre d'onglets (le pouce reste la cible). `px-page` 24 px.
- **≥ 1024 px (ordinateur)** : en-tête en verre + barre latérale (≥ 240 px) + contenu (base 560 px) ; rangées de 2 à 3 tuiles en proportions 2:1 (`2 1 400px` + `1 1 230px`). Contenu ≤ 1400 px, centré.
- Autant de tuiles que de contenus ; jamais deux tuiles identiques côte à côte par défaut ; une tuile sans données montre son état vide.
- Zones tactiles ≥ 44 px partout (onglets 52 px, ajout 56 px mobile). Actions fréquentes dans le tiers bas de l'écran sur mobile.
- Safe-area iOS : `viewport-fit=cover` et `env(safe-area-inset-*)` posés par la coque (tâches 13–14) : haut de page `max(16px, env(safe-area-inset-top))`, barre d'onglets ci-dessus, côtés en paysage.

## 7. Mouvement (ADR-006)
Une animation a une raison (hiérarchie, récit, feedback, état) ou elle saute. `transform` et `opacity` seulement ; on part toujours de la valeur affichée ; on ne bloque jamais l'input. Un élément n'est animé que par une bibliothèque : si une tuile est révélée par GSAP, son survol Motion s'applique à un enfant.

**Moments signature — GSAP**, dans `src/components/signature/`, chargés par `next/dynamic`, joués **une fois par session** (marqueur en `sessionStorage`), coupés par `gsap.matchMedia("(prefers-reduced-motion: reduce)")` qui pose l'état final sans transition :
| Moment | Effet | Durée, easing |
| --- | --- | --- |
| Entrée du tableau de bord | Tuile « Aujourd'hui » : `autoAlpha` 0 → 1, `y` 16 → 0 ; salutation puis intro en décalé | 0,6 s `power3.out`, décalage 0,08 s |
| Révélation de la grille | Tuiles : `autoAlpha` 0 → 1, `y` 24 → 0, dans l'ordre de lecture | 0,5 s `expo.out`, décalage 0,05 s, total ≤ 0,9 s, départ 0,15 s après la tuile pleine |
| Effets de verre | Les halos s'installent : `opacity` 0 → 1, `scale` 0,92 → 1 (élément dédié `aria-hidden` au lieu de `body::before` le jour où il est animé) ; jamais d'animation de `backdrop-filter` | 1,2 s `power2.out` |
| Bascule Privé / Pro (première de la session) | Pilule active glisse (`x`) ; tuiles du nouveau côté en fondu + `y` 8 → 0 | 0,4 s `power3.out` ; tuiles 0,25 s |
| Écrans vides | Icône, phrase, action : `autoAlpha` + `y` 12 → 0 en décalé | 0,4 s `power3.out`, décalage 0,06 s |

**Interactions — Motion** (`motion/react`, racine en `<MotionConfig reducedMotion="user">`, `useReducedMotion` pour le reste) :
- Pression (boutons, lignes, onglets) : `scale` 0,97, 0,1 s ease-out, au `pointerdown`.
- Survol d'une tuile (pointeur fin seulement) : `y` −2, ressort `bounce: 0`, 0,3 s.
- Catégorie de la barre latérale : chevron 0 → 90°, 0,2 s `ease-out-expo` ; sous-liste en `opacity` + `y` −4 → 0, 0,2 s (pas d'animation de hauteur).
- Palette (⌘K) : `opacity` + `scale` 0,98 → 1, 0,2 s `ease-out-expo` ; fermeture 0,15 s.
- Apparition / retrait d'un élément de liste : `opacity` + `y` 8, ressort `bounce: 0`, 0,3 s ; tiroir mobile : ressort `bounce: 0.2`, 0,3 s.
- Easing CSS commun : `--ease-out-expo` `cubic-bezier(0.16, 1, 0.3, 1)`.

Chaque module peut proposer ses propres moments signature, validés à sa spec, dans les mêmes règles.

**Règles** : gestes répétés (bascule, filtre, navigation) instantanés ; aucune boucle ; `prefers-reduced-motion` → fondus de 0,15 s au plus ou rien (filet global dans `globals.css`, plus les deux bibliothèques). `tw-animate-css` reste limité à l'entrée / sortie des primitives de `src/components/ui/`, jamais sur un élément animé par Motion ou GSAP.

## 8. Décisions hors référence (validées par Antoine le 2026-11-12)
1. **Erreurs et actions destructives en braise** (`#8A3810`) : la référence n'a pas de rouge ; la braise est sa seule couleur chaude (« + 2 pts » au-dessus de la cible). Elle sert aussi à la pastille Trustup : le texte d'erreur est toujours accompagné d'un libellé, jamais de la couleur seule.
2. **Bordure des champs en encre secondaire** : la bordure de la référence (encre 12 %) fait 1,26:1, sous les 3:1 exigés pour identifier un champ.
3. **Libellés des pastilles de chiffres en blanc plein** (référence : blanc 90 %, 4,03:1 sur la pastille, sous 4,5:1).
4. **Interligne du titre display 1,1** partout (référence ordinateur : 1,08) pour ne pas couper les capitales accentuées.
5. **Halos fixes** (ils défilent avec la page dans la référence) : fond stable, rendu moins coûteux ; dégradés radiaux plutôt que des disques floutés par `filter: blur`.
6. **Pilule mobile posée sur le fond nu** (comme la référence) : 5,06:1 sur brume, mais 4,3:1 si le halo bleu atteint 40 % sous la pilule. À contrôler à la tâche 14 sur capture réelle ; si ça tombe sous 4,5, éloigner le halo ou poser la pilule sur du verre.
7. **Tablette** (absente de la référence) : deux colonnes, barre d'onglets conservée jusqu'à 1024 px.
8. **Icônes Lucide** (le skill cite Phosphor, Tabler ou Radix) : déjà fournie par shadcn, et les icônes de la référence en ont le dessin (trait 2, bouts arrondis).
9. **Mobile en une colonne avec une paire « chiffre »** : la spec dit une colonne, la référence mobile montre deux petites tuiles côte à côte. Retenu : une colonne, sauf la paire de tuiles chiffre.

## 9. PWA (tâche 13)
- `theme_color` et `background_color` : `#E8ECF5` (brume ; `THEME_COLOR` et `BACKGROUND_COLOR` dans `src/lib/theme.ts`, lus par le `viewport` et par `src/app/manifest.ts`). `apple-mobile-web-app-status-bar-style` : `default` (barre sombre sur fond clair).
- Manifeste : `display: standalone`, `start_url: /dashboard`, `scope: /`, nom et description = `app.name` / `app.description` de `messages/fr.json`.
- **Zones sûres iOS** : `viewportFit: "cover"`. Avec `statusBarStyle: "default"`, la page reste sous la barre d'état iOS : `--safe-top` vaut 0 en portrait. Les zones sûres utiles sont le bas (barre d'accueil) et les côtés (encoche en paysage) ; le haut ne compte qu'en `black-translucent` (non retenu). Variables `--safe-top`, `--safe-right`, `--safe-bottom`, `--safe-left` (`env(safe-area-inset-*, 0px)`) dans `globals.css`, utilitaires Tailwind `pb-safe-bottom`, `pl-safe-left`, `pr-safe-right`, `pt-safe-top` (ou `calc(var(--safe-bottom) + …)`). La coque (tâche 14) les applique : barre d'onglets au-dessus de `--safe-bottom`, contenu écarté des côtés ; `--safe-top` posé quand même sur l'en-tête (0 aujourd'hui, juste si le style de barre change). Aucun autre composant ne s'en occupe.
- **Icône d'app** : le logo de la référence. Carré plein indigo `#3D4FD6` à fond perdu ; au centre, le glyphe blanc `#FFFFFF` « étincelle » : un cercle de rayon 3 et huit rayons, sur une grille 24 × 24, trait 2, bouts et angles arrondis, sans remplissage :
  `<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>`
  - 192 et 512 px : coins arrondis à 35 % du côté (14 px sur 40 dans la référence), glyphe à 50 % de la largeur.
  - Maskable 512 px : carré plein sans arrondi, glyphe à 40 % de la largeur (dans la zone sûre de 80 %).
  - apple-touch-icon 180 px : carré plein sans arrondi ni transparence (iOS arrondit), glyphe à 50 %.
  - Favicon : même dessin, 32 px, trait épaissi à 2,4 pour rester lisible.
- Pas de texte dans l'icône. Le nom de l'app vient des messages de la langue par défaut.
- Source versionnée : `docs/design/icon.svg` (glyphe). Fichiers dérivés : `public/icons/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) et `src/app/favicon.ico`. Régénérer : `node scripts/generate-icons.mjs` (rasterisé par le Chromium de Playwright).

## 10. Thème sombre (stratégie seulement)
- Aucune valeur sombre n'est fixée : elles seront tirées d'une référence sombre validée, comme le clair.
- Les composants n'utilisent que les tokens sémantiques ; le sombre redéfinira ces mêmes noms (`--background`, `--foreground`, `--primary`, `--glass-bg`, `--glass-border`, `--glass-shadow`, `--row-bg`, `--on-primary-*`, `--track`, `--pill-track`, `--chip-*`, `--halo-layers`…) sous `.dark` (variante déjà déclarée) ou `prefers-color-scheme: dark`, sans toucher aux composants.
- À ce moment : `color-scheme: dark`, `THEME_COLOR` par schéma (`themeColor` accepte une liste par `media`), mêmes exigences de contraste recalculées, et la tuile « Aujourd'hui » reste la seule tuile pleine.

## 11. Interdits
- Une couleur, une police, un rayon ou une ombre hors de ce fichier ; une valeur arbitraire en ligne (`#…`, `mt-[13px]`).
- Une deuxième tuile pleine ; du verre sur du verre ; une ombre noire.
- Du texte secondaire directement sur le cœur d'un halo ; du texte en dégradé.
- Une zone tactile sous 44 px ; un focus invisible ; un placeholder comme libellé.
- Une animation sur `width`, `height`, `top`, `left` ou `backdrop-filter` ; une boucle ; un moment signature rejoué sur un geste répété.
