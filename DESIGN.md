---
name: BeMyBrain
description: Second cerveau personnel — verre dépoli clair sur brume bleu-lilas, une seule tuile pleine pour aujourd'hui.
colors:
  mist: "#E8ECF5"
  halo-blue: "#AFC0F4"
  halo-lilac: "#D6C6F2"
  halo-aqua: "#BCE2EC"
  ink: "#1B2033"
  ink-muted: "#535A72"
  indigo: "#3D4FD6"
  indigo-deep: "#2B3AA8"
  ember: "#8A3810"
  ember-soft: "#E8743B"
  white: "#FFFFFF"
  glass: "rgb(255 255 255 / 0.58)"
  glass-border: "rgb(255 255 255 / 0.75)"
  row: "rgb(255 255 255 / 0.5)"
  border: "rgb(27 32 51 / 0.12)"
  track: "rgb(27 32 51 / 0.09)"
  pill-track: "rgb(27 32 51 / 0.07)"
  scrim: "rgb(27 32 51 / 0.2)"
  on-primary-muted: "rgb(255 255 255 / 0.86)"
  on-primary-lead: "rgb(255 255 255 / 0.9)"
  on-primary-surface: "rgb(255 255 255 / 0.16)"
  priority-urgent-bg: "rgb(236 71 100 / 0.11)"
  priority-urgent-fg: "#7F1F31"
  priority-high-bg: "rgb(236 137 4 / 0.1)"
  priority-high-fg: "#663E06"
  priority-medium-bg: "rgb(236 210 25 / 0.17)"
  priority-medium-fg: "#564B01"
  priority-low-bg: "rgb(16 174 101 / 0.1)"
  priority-low-fg: "#01522C"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "clamp(1.875rem, 1.643rem + 0.952vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.1
  figure:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "clamp(2.125rem, 1.846rem + 1.143vw, 2.875rem)"
    fontWeight: 600
    lineHeight: 1
  headline:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "clamp(1.375rem, 1.282rem + 0.381vw, 1.625rem)"
    fontWeight: 600
    lineHeight: 1.2
  page-title:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "clamp(1.375rem, 1.282rem + 0.381vw, 1.625rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 600
    lineHeight: 1.25
  stat:
    fontFamily: "Space Grotesk, Inter, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.1
  lead:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(0.9375rem, 0.914rem + 0.095vw, 1rem)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(0.75rem, 0.727rem + 0.095vw, 0.8125rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  chip:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  tab:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "20px"
  tile: "24px"
  tile-desktop: "28px"
  bar: "30px"
  full: "9999px"
spacing:
  grid: "14px"
  grid-tablet: "16px"
  grid-desktop: "20px"
  tile: "18px"
  tile-desktop: "24px"
  today: "22px"
  today-desktop: "28px"
  page: "16px"
  page-tablet: "24px"
components:
  button-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.indigo-deep}"
  button-secondary:
    backgroundColor: "rgb(255 255 255 / 0.6)"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "44px"
  input:
    backgroundColor: "{colors.row}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 12px"
  tile-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile}"
  tile-today:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.tile}"
    padding: "{spacing.today}"
  list-row:
    backgroundColor: "{colors.row}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 14px"
  pill-toggle-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "44px"
  pill-toggle-inactive:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    height: "44px"
  tabbar:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.bar}"
    padding: "8px 10px"
  fab:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    size: "56px"
---

# DESIGN — BeMyBrain

Charte visuelle, source unique de vérité. Contexte produit : `PRODUCT.md`. Tokens implémentés dans `src/app/globals.css` (verrouillés par `tests/design/tokens.test.ts`). L'en-tête YAML reprend ces tokens au format Impeccable / DESIGN.md (valeurs mobiles par défaut, variantes `-desktop` / `-tablet`) ; en cas d'écart, `globals.css` et les tableaux ci-dessous font foi. Extensions (rampes, ombres, mouvement, composants rendus) : `.impeccable/design.json`.

**Image directrice : « La Vitre du matin ».** Du verre dépoli clair posé sur une brume bleu-lilas au lever du jour : calme, lumineux, sans bruit. Une seule tuile pleine, indigo, dit ce qui compte aujourd'hui ; tout le reste attend derrière la vitre. La marque vit dans la précision des détails (ombres bleutées, rayons doux, chiffres en Space Grotesk), jamais dans le décor.

**Statut** : validé par Antoine le 2026-11-12 (tâche 12 du socle) ; fusionné avec le format Impeccable (`/impeccable document`) le même jour.
**Référence validée** (thème clair) : `docs/design/references/dashboard-desktop.dc.html` (1440 px) et `dashboard-mobile.dc.html` (390 px). Inspiration d'origine, secondaire : `finance-glass.webp`, `maison-bento.webp`.
**Méthode** : skill `nexxia-design` + Impeccable.

## 1. Lecture et curseurs
Tableau de bord personnel · Antoine puis abonnés, surtout au téléphone · calme, lumineux, net · Next.js + Tailwind v4 + shadcn/ui (base-nova) personnalisé.

| Écran | VARIANCE | MOTION | DENSITY | Pourquoi |
| --- | --- | --- | --- | --- |
| Tableau de bord et coque | 4 | 5 | 5 | Preset « App SaaS » (4 / 3 / 6) : MOTION +2 pour les moments signature (ADR-006), DENSITY −1 pour le mobile (preset Dopamine). |
| Connexion, réinitialisation, erreurs | 2 | 1 | 3 | Une colonne, aucune distraction. |

Verrous : thème clair (un seul, jamais inversé entre sections) · un accent, l'indigo · une famille de gris, l'encre bleutée · rayons doux + pilule · icônes Lucide (déjà fournie par shadcn) trait 2, bouts arrondis, 20–22 px · Motion pour les interactions, GSAP pour les moments signature (ADR-006).

## 2. Couleurs
Toutes viennent de la référence, sauf les quatre teintes de priorité (plus bas, décision d'Antoine du 2026-11-25). Aucune autre couleur n'entre sans passer par ce fichier. Les composants n'utilisent que les tokens sémantiques (`bg-primary`, `text-muted-foreground`, `bg-glass`…), jamais la palette brute : c'est ce qui permettra le thème sombre.

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
| `pill-track` | encre 7 % | Piste de la bascule Privé / Pro et du filtre d'espace | secondaire 5,06 sur brume ; 4,82 sur verre (calculé ; 4,85 mesuré sur capture dans la barre latérale, 2026-11-13) |
| `scrim` | encre 20 % | Voile sous les fenêtres modales (palette, puis dialogues), jamais flouté ; posé à `--z-overlay` (§ 4) | décoratif, ne porte aucun texte |
| `accent` / `secondary` | blanc 55 % / blanc 60 % | Survol d'un élément de liste ; bouton secondaire | encre ≥ 12 |
| `sidebar` | `--glass-bg` (bord `glass-border`, actif blanc, anneau indigo) | Barre latérale : surface en verre de premier niveau, posée sur le fond | comme le verre |
| `popover` | `--white` | Menus, palette : opaques (jamais de verre sur du verre) | encre 16,1 |
| `chip-neutral` | encre 8 % + `--ink` | Pastille d'espace neutre (défaut ; Privé à la migration 0007) | ≥ 11,16 |
| `chip-warm` | braise claire 16 % + `--ember` | Pastille d'espace chaude (Trustup à la migration 0007) | ≥ 5,52 |
| `chip-indigo` | indigo 13 % + `--indigo-deep` | Pastille d'espace indigo (Nexxia à la migration 0007) | ≥ 6,21 |
| `priority-urgent` | `rgb(236 71 100 / 0.11)` + `#7F1F31` (rouge rosé) | Priorité urgente (1) : badge, pastille et menu du détail | texte sur fond : 8,54 sur carte, 8,23 sur ligne, 6,43 sur colonne, 4,56 au pire ; fond sur surface : 1,15 / 1,15 / 1,13 |
| `priority-high` | `rgb(236 137 4 / 0.1)` + `#663E06` (orangé, encre brune) | Priorité haute (2) | texte sur fond : 8,48 / 8,25 / 6,46, 4,56 au pire ; fond sur surface : 1,10 / 1,09 / 1,07 |
| `priority-medium` | `rgb(236 210 25 / 0.17)` + `#564B01` (jaune, encre brun-olive) | Priorité moyenne (3) | texte sur fond : 8,09 / 7,87 / 6,29, 4,59 au pire ; fond sur surface : 1,08 / 1,07 / 1,03 |
| `priority-low` | `rgb(16 174 101 / 0.1)` + `#01522C` (vert jade) | Priorité basse (4) | texte sur fond : 8,45 / 8,16 / 6,39, 4,57 au pire ; fond sur surface : 1,11 / 1,11 / 1,09 |
| `chart-1` à `chart-5` | indigo, indigo profond, braise claire, encre secondaire, encre | Provisoire, à fixer au premier graphique | — |

États dérivés : survol d'un élément de liste ou de navigation = `accent` (le fond « ouvert » de la référence) ; élément actif = blanc + `shadow-raised` ; pression = `scale(0.97)` ; désactivé = opacité 60 % et `cursor: not-allowed` (exempté de contraste par WCAG, mais le libellé reste lisible). La couleur d'une pastille de contexte (neutre, chaude, indigo) est attribuée par contexte ; quand les contextes deviendront configurables, la couleur sera choisie parmi ces trois, jamais saisie.

### Teintes de priorité (décisions d'Antoine du 2026-11-25, validées sur iPhone le 2026-11-26)
Seules couleurs hors de la référence. Une teinte par niveau, fond pastel + encre foncée de la même famille ; « Aucune » (0) n'a ni teinte ni icône propre. Surfaces des contrastes ci-dessus : carte (`popover`), ligne (`row` sur verre sur brume), colonne creusée (`pill-track` sur brume) ; « au pire » : colonne au cœur du halo bleu. Mesurés sur le rendu le 2026-11-25 : 8,09 à 8,54 sur carte, 7,81 à 8,23 sur ligne (1280 px ; le jaune, le plus bas, y est mesuré à 7,81 pour 7,87 calculé, écart d'arrondi du rendu sur le verre). Le fond ne porte aucune information seul (1,03 à 1,15).
- **Échelle que tout le monde lit** : rouge pour urgente, orangé pour haute, jaune pour moyenne, vert pour basse (teintes des fonds en OKLCH : 6°, 75°, 100°, 168°). Le jaune garde plus de couleur que les trois autres (C 0,041 contre 0,020) : plus pâle, il se lit crème et se confond avec l'orangé ; son encre est un brun-olive foncé, jamais un jaune.
- **Un cran plus pastel que les pastilles d'espace** : fonds à L 0,955 à 0,972 sur blanc (pastilles : 0,935 à 0,947), C 0,020 pour le rouge, l'orangé et le vert (pastilles : 0,023). Encres à la clarté de l'indigo profond (L 0,39 à 0,41).
- **Urgente en rouge pastel, décision d'Antoine du 2026-11-25 ; la braise reste le texte du retard et des erreurs ; les deux se distinguent par la forme : badge teinté à icône pour la priorité, texte sans fond pour le retard.** Le rouge est plus rosé et plus sombre que la braise : encre à 15° contre 43° (28° d'écart), L 0,40 contre 0,45.
- **Haute et pastille d'espace chaude** : les deux fonds sont voisins (0,025 d'écart en OKLab sur blanc, 26° de teinte, 1,07:1 entre eux), l'orangé plus clair et plus jaune. C'est la forme qui les sépare : le badge de priorité est un carré arrondi à icône, sans libellé ; la pastille d'espace est une pilule à nom, sans icône (§ 5).
- **Jamais la couleur seule** : l'icône du niveau est toujours présente, la couleur ne porte jamais seule l'information. En deutéranopie, les fonds rouge et vert se confondent (écart 0,006, contre 0,039 en vision ordinaire), et les encres orangée et jaune aussi ; en protanopie, les encres orangée, jaune et verte se rapprochent de la braise. L'ordre se lit alors à l'icône (alerte, puis trois, deux, une barre), verrouillée distincte par niveau (`priority-icons.test.ts`).

## 3. Typographie
Inter pour le texte, Space Grotesk pour les titres et les chiffres, toutes deux par `next/font/google` (variables `--font-inter`, `--font-space-grotesk` ; utilitaires `font-sans`, `font-heading`). Graisses : 400, 500, 600 ; jamais 700. `h1`–`h3` prennent Space Grotesk par défaut.

| Token | Taille 390 → 1440 px | Interligne | Police, graisse | Usage |
| --- | --- | --- | --- | --- |
| `text-display` | 30 → 40 px (fluide) | 1,1 | Space Grotesk 600 | « Bonjour Antoine. » de la tuile pleine |
| `text-section` | 22 (dérivé) → 26 px | 1,2 (dérivé) | Space Grotesk 600 | Titre de groupe de tuiles (« Budget, placements et patrimoine ») |
| `text-page-title` | 22 → 26 px | 1,2 | Space Grotesk 600 | Titre de page (`h1` de `PageHeader`, connexion, réinitialisation, erreurs) |
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

**Titre de page** (décision d'Antoine, 2026-11-13) : un seul style pour tout `h1` de page, `text-page-title`, mêmes valeurs que `text-section`, sans approche serrée ni tracking (la référence n'en met sur aucun titre) ; justification : la référence n'a pas de titre de page, et son seul titre hors tuile est le titre de groupe à 26 px, alors que `text-display` reste réservé à la salutation de la tuile pleine, qui doit rester le plus grand texte de l'écran.
« Dérivé » : la référence ne fixe pas l'interligne (valeur navigateur) ou ne montre pas la taille mobile ; valeur choisie ici, à valider avec le reste.
Champs de formulaire : 16 px (`text-base`), sinon Safari iOS zoome au focus.
Alternatives contextuelles coupées (`font-variant-ligatures: no-contextual` sur `html`, 2026-11-20) : le `calt` d'Inter transforme « 3x0 » en « 3×0 » et « -> » en flèche ; le texte saisi doit s'afficher tel quel. Space Grotesk n'a pas ce trait (vérifié au rendu dans Chromium le 2026-11-20 : « 3x0 » et « -> » inchangés avec ou sans `calt`) ; le réglage le couvre aussi, par héritage. Ne pas rallumer `calt` (ni `font-feature-settings`, ni `font:` qui réinitialiserait les ligatures).
FR et EN : le français est 15 à 30 % plus long. Aucune largeur fixe sur un libellé ; les titres passent sur deux lignes plutôt que d'être tronqués (exception : les lignes de tâche dans une tuile du tableau de bord, sur une ligne, § 6) ; aucune césure automatique (décision d'Antoine du 2026-11-23, « aujourd'-hui » coupé dans la tuile pleine) : un mot passe entier à la ligne ; onglets mobiles : un mot par langue, vérifié dans les deux (« Paramètres » / « Settings »). Corps ≤ 65 caractères par ligne.

## 4. Rayons, ombres, verre, calques
**Rayons** (doux + pilule, un seul système) : `rounded-sm` 8 px (touche ⌘K) · `rounded-md` 12 px (sous-catégorie) · `rounded-lg` 14 px (ligne de liste, élément de navigation, logo, champ, bouton rectangulaire) · `rounded-xl` 20 px (pastille de chiffre) · `rounded-tile` 24 px mobile / 28 px ordinateur (tuiles, en-tête, barre latérale) · `rounded-bar` 30 px (barre d'onglets) · `rounded-full` (pilules, boutons ronds, pastilles, barres de progression). Ce sont les seuls rayons : les défauts de Tailwind (`rounded-2xl`, `3xl`, `4xl`…) sont retirés du thème (`--radius-*: initial`).

**Ombres** (toujours bleutées) : `shadow-glass` `0 8px 28px` mobile / `0 10px 36px` ordinateur, teinte d'ombre à 9 % · `shadow-today` `0 14px 34px` / `0 18px 44px`, indigo à 28 % · `shadow-raised` `0 2px 8px`, teinte d'ombre à 14 % (pilule active, élément actif ; dérivé : la référence met 12 % sur l'élément actif de la barre latérale, unifié à 14 %) · `shadow-fab` `0 8px 20px`, indigo à 35 % (bouton d'ajout mobile).

**Verre** (`glass`, utilitaire de `globals.css`) : fond blanc 58 % (mobile) / 56 % (ordinateur), `backdrop-filter: blur(24px | 26px) saturate(150%)`, bord 1 px blanc 75 %, `shadow-glass`. Règles : jamais deux verres empilés (une ligne dans une tuile est `row`, pas du verre ; menus et palette sont opaques) ; `prefers-reduced-transparency` → fond opaque de même teinte, sans flou.

**Fond** : brume `--mist` + halos en dégradés radiaux fixes (`body::before`, aucune image) ; mobile : bleu en haut à gauche, lilas à droite ; ordinateur : + aqua en bas. Le texte secondaire ne se pose jamais directement sur le cœur d'un halo (voir contrastes).

**Calques** (`z-(--z-…)`) : `--z-halo` −1 · `--z-content` 1 · `--z-header` 10 · `--z-tabbar` 20 · `--z-overlay` 40 · `--z-dialog` 50 · `--z-toast` 60. Le voile `scrim` est posé à `--z-overlay`, sous la fenêtre (`--z-dialog`).

**Espacements** (base Tailwind 4 px, plus) : `gap-grid` 14 / 16 / 20 px (mobile / tablette / ordinateur) · `p-tile` 18 / 24 px · `p-today` 22 / 28 px · `px-page` 16 / 24 px / `clamp(14px, 2.4vw, 36px)` · largeur max du contenu 1400 px.

## 5. Composants de base
Sourcing : primitives shadcn/ui (base-nova) réalignées sur ces tokens, sinon composants maison dans `src/components/`. Un composant importé est relu contre ce fichier.

- **Tuile verre** (`section`) : `glass rounded-tile p-tile`, colonne, `gap-4`. En-tête : surtitre (`text-eyebrow text-muted-foreground`) + titre (`text-title`), lien d'action à droite (`text-small font-semibold text-link`, zone ≥ 44 px par padding). Contenu : lignes `row rounded-lg min-h-11 px-3.5`, `text-body`. Note de bas en `text-caption text-muted-foreground`. Hauteur du contenu (§ 6) : aucune hauteur imposée, la tuile n'est pas étirée par sa rangée.
- **Tuile « Aujourd'hui »** : la seule tuile pleine de l'app. `bg-primary text-primary-foreground shadow-today rounded-tile p-today`. Date en surtitre (`on-primary-muted`), salutation en `text-display`, intro en `text-lead text-on-primary-lead`, puis pastilles de chiffres (`on-primary-surface`, bord `on-primary-border`, `rounded-xl`, chiffre en `text-stat`, libellé `text-small` **en blanc plein**). Puis, quand un module en fournit (to-do, 2026-11-19), jusqu'à 3 lignes `rounded-lg min-h-11 px-3.5` sur `on-primary-surface`, bord `on-primary-border`, texte `text-body` blanc plein, légende `text-caption` en blanc plein aussi (sur `on-primary-surface`, le blanc plein ne donne que 4,56 : `on-primary-muted` tomberait sous 4,5) ; case à cocher comprise (`accent-color` blanc), lien « Voir la to-do » en blanc plein `font-semibold` (la liste ne montre que le côté actif). Intro : aucune phrase quand la tuile a des tâches (les pastilles le disent) ; rien de dû : « Rien en retard, rien de prévu aujourd'hui. » (état vide compact, § 6) ; côté sans espace : la phrase d'absence d'espace. Moins de 3 tâches : rien sous les lignes, la tuile est plus courte. Lecture en échec : message `text-small` blanc plein à la place des pastilles et des lignes. Pas de verre ni de pastille de contexte colorée dans la tuile pleine : le côté s'écrit en légende. Focus dedans : `ring-on-primary`.
- **Pilule de bascule Privé / Pro** : `role="group"` + `aria-label`, deux boutons `aria-pressed`. Piste `bg-pill-track rounded-full p-1 gap-1` ; bouton `min-h-11 rounded-full text-body font-semibold`, padding horizontal 18 px (mobile) / 22 px (ordinateur) ; actif : fond blanc, `text-foreground`, `shadow-raised` ; inactif : transparent, `text-muted-foreground`. Toujours en haut : dans l'en-tête en verre (ordinateur), en haut à droite à côté du nom (mobile).
- **Filtre d'espace** : « tous » (« Les deux » pour deux espaces) ou un seul espace du côté actif. Existe des deux côtés, Privé et Pro (BRAIN-30), affiché dès que le côté a au moins deux espaces ; sélection mémorisée par côté (cookie `bmb_contexts_<côté>`), revalidée contre les espaces du workspace. Ordinateur (≥ 1024 px) : dans la barre latérale, sous le titre du côté ; liste verticale (`role="group"`, boutons `aria-pressed`) sur une piste `bg-pill-track rounded-lg p-1 gap-1`, sans verre (la barre latérale en est déjà), boutons `min-h-11 rounded-md px-3 text-small font-semibold` alignés à gauche, actif blanc + `shadow-raised` ; liste plutôt que pilules qui passent à la ligne : les noms saisis gardent un alignement lisible à 212 px utiles. Mobile (< 1024 px) : une pastille en verre à côté du titre de page (`PageHeader`), `min-h-11 rounded-full`, nom de l'espace retenu + chevron, qui ouvre un menu opaque (`popover`, `rounded-lg`, `shadow-glass`) : « tous », puis chaque espace, élément `min-h-11`, coche sur le choix courant ; clavier, Échap et focus rendu à la pastille (menu de Base UI). Pression : comme les boutons (`scale` 0,97) ; changement instantané, `aria-busy` pendant l'enregistrement, échec traité comme l'exception des **Boutons**.
- **Interrupteur « Terminées »** (en-tête de la liste des tâches) : pastille en verre `min-h-11 rounded-full`, libellé `text-small font-semibold`, `role="switch"`. Piste `h-5 w-9 rounded-full` : éteint `bg-pill-track` bordé `border border-input` (seul repère à ≥ 3:1 sur le verre, la piste seule donne ≈ 1,1:1) ; allumé `bg-primary`, sans bord. Bouton 16 px blanc (`popover`) + `shadow-raised`. Changement instantané, `aria-busy` pendant le rendu.
- **En-tête (ordinateur)** : verre, `rounded-tile`, `px-4 py-3`, 78 px de haut (pilule de bascule 52 px + `py-3` + bord, `--header-height` dans `globals.css`) : logo (carré indigo 40 px, `rounded-lg`, glyphe blanc) + nom, pilule au centre, recherche « Chercher ou ajouter ⌘K » (bouton secondaire pilule, bord `border`), qui ouvre la palette, puis bouton d'ajout rond 44 px `bg-primary` (icône + 20 px trait 2,4, `hover:bg-primary-hover`) qui ouvre l'ajout rapide (retiré le 2026-11-16, revenu avec la to-do, spec todo-unifiee).
- **En-tête (mobile)** : nom + pilule Privé / Pro sur le fond nu, puis bouton rond 44 px en verre (`glass`, icône loupe 20 px en `foreground`) qui ouvre la palette ; l'ajout rapide est au « + » de la barre d'onglets.
- **Panneau du détail (ordinateur)** : à partir de 1024 px, panneau opaque (`popover`) à droite, largeur `max-w-md`, `rounded-tile`. Départ sous l'en-tête (`--detail-top` : haut de page + `--header-height` + `gap-grid`), bord droit aligné sur celui de la coque (`--detail-right`), défilement interne. Sous 1024 px : tiroir bas.
- **Barre latérale (ordinateur)** : verre, `rounded-tile`, `p-3.5`, largeur ≥ 240 px, alignée en haut. Titre du côté (« Vie privée » / « Vie pro ») en surtitre, puis le filtre d'espace quand le côté en a au moins deux, puis les catégories. Catégorie = bouton `min-h-11 px-3.5 rounded-lg text-body font-semibold`, chevron 16 px à droite (`text-muted-foreground`, pivote de 90° ouvert), `aria-expanded`. Actif : fond blanc + `shadow-raised` ; ouvert : `accent`. Sous-catégories : liens `min-h-11 px-3.5 rounded-md text-small font-medium text-muted-foreground`, retrait de 18 px. Les catégories suivent le côté actif.
- **Barre d'onglets (mobile)** : verre, flottante, `rounded-bar`, `px-2.5 py-2`, à 16 px des bords, `bottom: max(26px, env(safe-area-inset-bottom) + 8px)`, `z-(--z-tabbar)`. Quatre onglets (`min-h-13`, icône 22 px au-dessus d'un `text-tab`) : actif `text-link`, inactifs `text-muted-foreground`, `aria-current="page"` sur l'actif. Au centre, bouton d'ajout rond 56 px, `bg-primary`, `shadow-fab`, icône + 24 px trait 2,4, qui ouvre l'ajout rapide. Le contenu réserve sa hauteur en bas (≈ 68 px + décalage + 16 px).
- **Boutons** : principal `bg-primary text-primary-foreground hover:bg-primary-hover` ; secondaire `bg-secondary border border-border text-secondary-foreground` ; discret (lien d'action) `text-link`. Hauteur ≥ 44 px, `text-body font-semibold`, `rounded-full` dans la coque (comme la référence), `rounded-lg` pour un bouton pleine largeur de formulaire. Pendant un appel : désactivé, libellé d'attente. Exception, limitée aux préférences d'affichage (bascule Privé / Pro, filtre d'espace ; 2026-11-13) : le contrôle reste cliquable et change tout de suite, `aria-busy` pendant l'enregistrement ; en cas d'échec, retour à l'état enregistré avec un message visible (bulle opaque `popover` sous le contrôle, `text-destructive`, `role="status"`, effacée au geste suivant ou après 5 s). Données métier : tranché à la spec de chaque module.
- **Champs** : libellé visible au-dessus (`text-small font-medium`), jamais le placeholder comme libellé. `min-h-11 rounded-lg border border-input bg-row px-3 text-base`. Erreur sous le champ, `text-destructive`, reliée par `aria-describedby`. Exception, limitée à la ligne « Ajouter une sous-tâche » du détail (D8 de la démo todo-kanban, 2026-11-24 ; validée le 2026-11-25) : sous le titre de section « Sous-tâches », le libellé reste dans le DOM en `sr-only`, le texte d'invite lui est identique et une icône « + » le précède.
- **Cases à cocher** : 18 px, `accent-color: primary`, ligne entière cliquable (`label` `min-h-11`).
- **Barres de progression** : piste `bg-track h-2.5 rounded-full`, remplissage `bg-primary` ; elles portent une donnée, jamais décoratives.
- **Pastilles d'espace** : `rounded-full px-2.5 py-0.5 text-chip`, couleur `chip-*` choisie par `contexts.color` (`neutral`, `warm`, `indigo`).
- **Priorité** (décisions d'Antoine du 2026-11-25, teintes et badge validés sur iPhone le 2026-11-26 ; application : tâche 12 du plan todo-kanban) : niveaux 1 à 4, teinte `priority-*` (§ 2) et icône du niveau (`priority-icons.ts`), toujours ensemble. Carte, ligne et tuile : badge carré arrondi `size-5 rounded-sm` (20 px, la hauteur d'une pastille d'espace), icône 16 px seule sur le fond teinté, à l'encre de la teinte, libellé en `sr-only` ; jamais avec un libellé visible. À 8 px de rayon sur 20 px, le badge est presque rond : ce n'est pas sa forme qui le sépare d'une pastille d'espace, c'est l'icône sans nom contre le nom sans icône. Forme validée par Antoine sur iPhone le 2026-11-26 ; accroché à la dernière information de la légende. Détail : la pastille Priorité (forme des pastilles de champ, 44 px) prend le fond et l'encre de la teinte choisie, icône et libellé ; dans son menu, chaque option porte le badge de son niveau (même carré teinté, icône 16 px à l'encre de la teinte) devant son libellé resté à l'encre ; « Aucune » garde la place vide. « Aucune » : pastille ordinaire, icône du champ, pas de teinte. La braise reste le texte du retard et des erreurs, sans fond.
- **Tableau et liste, surfaces « Creux »** (décision d'Antoine du 2026-11-25, variante retenue de la démo) : colonne `bg-pill-track`, posée à nu sur la brume, sans verre ni ombre ; en-tête de colonne à l'encre (`text-foreground`) ; jamais de texte secondaire sur la colonne (3,51:1 au cœur d'un halo). Carte `bg-popover border border-border shadow-raised`, opaque. Calque du glisser : même carte, `shadow-glass`. Survol d'une carte (pointeur fin seulement, rien au doigt ni pendant un glisser ; tâche 13 du plan todo-kanban, 2026-11-26) : contour `input` (`outline` de 1 px posé sur le bord, rien ne se décale), `shadow-glass` ajoutée à la `shadow-raised` de la carte, et la carte monte de 2 px en 0,3 s, même course et même durée que le ressort de tuile (§ 7), par transition CSS (`--ease-out-expo`) : aucun composant d'animation dans une carte déplaçable ; pas de montée en mouvement réduit. Empreinte d'une carte saisie : fond `row`, plus clair que la colonne (mesuré 1,17:1 sur brume, 1,43:1 au cœur du halo bleu), et pointillé de 2 px `input` tracé vers l'intérieur (mesuré 5,04:1 contre la colonne sur brume, 3,48:1 au cœur du halo bleu) ; l'indigo reste à l'anneau de focus et à la cible de dépôt. Carte fermée (terminée, annulée) : titre en texte secondaire et légende sans couleur (`grayscale`, pastilles d'espace et badge de priorité compris ; pas d'opacité, qui ferait tomber le texte sous 4,5:1 ; mesuré en gris : date 6,90:1, pastille chaude 7,86:1, icône du badge Urgente 10,67:1). Jamais deux verres empilés ; la barre d'onglets mobile reste en verre. La liste des tâches suit la même règle : lignes claires et bordées sur un fond teinté, aucun texte secondaire hors des lignes.
- **Onglets du tableau et onglet cible (mobile, sous 768 px)** (tâche 14 du plan todo-kanban, 2026-11-26) : barre en verre `rounded-full`, onglets `min-h-11 rounded-full px-4 text-small font-semibold`, choisi `bg-pill-active text-foreground shadow-raised`, les autres `text-muted-foreground` ; l'en-tête de colonne n'est pas répété sous l'onglet. Pendant un glisser, l'onglet visé prend l'état du choisi et l'anneau de cible (`outline-2 outline-ring`), et la barre défile pour le montrer en entier ; la carte portée masquant la barre, un repère de même forme (pilule `pill-active`, `shadow-raised`, anneau, libellé et compteur) s'accroche au-dessus d'elle, en dessous quand elle touche le haut de l'écran. Amorce quand des onglets sont hors champ : les onglets se fondent sur les derniers 10 % de la barre et le bord prend un dégradé `pill-track` de 32 px, du côté concerné seulement ; aucune flèche.
- **Colonne repliable du tableau (768 px et plus)** (décision d'Antoine du 2026-11-25, tâche 15 du plan todo-kanban) : repliée, un bandeau `bg-pill-track rounded-tile p-tile` à la largeur de son libellé (environ 108 px contre 320), sur toute la hauteur du tableau ; de haut en bas : bouton rond 44 px (icône Lucide de 20 px à l'encre, `ChevronsLeftRight` pour déplier, `ChevronsRightLeft` pour replier, survol `bg-row`), libellé en `text-eyebrow text-foreground` écrit en entier à l'horizontale, compteur dessous ; jamais de texte pivoté, abrégé ou tronqué. Tout le bandeau déplie au clic et reçoit les cartes (anneau `outline-2 outline-ring` quand il est visé) ; dépliée, c'est une colonne ordinaire dont l'en-tête porte le même bouton à droite du compteur. Sous 768 px, pas de bandeau : un onglet comme les autres.
- **Exceptions gardées du détail** (décisions d'Antoine du 2026-11-25, issues de la démo) : ligne « Ajouter une sous-tâche » sans libellé visible (voir **Champs**) ; libellé « Notes » en semi-gras (`font-semibold`, à la taille d'un titre de section, au lieu du `font-medium` des **Champs**) ; notes vides repliées à 46 px de haut (44 px + bord) ; ombre de saisie d'une carte (calque du glisser) en `shadow-glass`, sans token d'ombre plus marquée ni agrandissement.
- **Pastille de côté (Privé / Pro)** : même forme, contour `border border-border`, texte `text-foreground`, aucun fond `chip-*` (jamais confondue avec un espace). Seulement dans la corbeille, qui mêle les deux côtés.
- **États de chargement — givre** (BRAIN-33) : un seul composant réutilisable, en CSS pur (aucun JS, il s'affiche avant le reste du code). Il remplace les squelettes : aucune barre de texte simulée. Le vrai titre de la page, puis des tuiles aux dimensions et positions réelles (aucun décalage de mise en page). Dans chaque tuile de verre du givre, un voile teinté (jamais un second verre) : dégradé à 135° de `var(--frost-from)` vers `var(--frost-to)`. Opacité 1 → `var(--frost-rest)` (repos, le voile reste affiché), 1,3 s par tuile, décalage 0,18 s : un seul éclaircissement, aucune boucle. Cran « discret », retenu pour toute l'app aux essais iPhone du 2026-11-23 : halos purs (`--frost-from: var(--halo-blue)`, `--frost-to: var(--halo-lilac)`), repos 0,55 ; variables sur `:root`, que `frost` lit sans les redéfinir. Tuile pleine « Aujourd'hui » : couleur primaire, sans voile. Tableau de bord (QA-6) : chaque tuile givrée réserve la hauteur affichée de sa tuile au dernier affichage, étirement de la rangée compris. Le navigateur la relève après chaque affichage et redimensionnement (`TileHeightRecorder`) dans le cookie `bmb-dashboard-tiles` (`Path` de la route du tableau de bord, `SameSite=Strict`, `Secure`, 30 jours), un relevé par côté (Privé / Pro) et par palier d'écran (`--tile-tier` : < 640, 640–1023, ≥ 1024, posé avec la grille dans `globals.css`) ; le filtre d'espace n'est pas une clé (persistant, le dernier relevé est le sien). `loading.tsx` le lit au rendu serveur (aucun script, aucun éclair), le valide (`src/modules/dashboard/tile-heights.ts` : tuiles connues du côté, entiers bornés à 80–1 200 px, cookie > 1 024 caractères ignoré) et pose les hauteurs en variables `--tile-h-sm|md|lg` ; `.tile-reserve` applique celle du palier courant. Sans relevé (première ouverture, nouvel appareil, nouveau palier), la tuile givrée a la hauteur de l'état vide compact de sa tuile (§ 6), donnée par une cale invisible et inerte que rendent les composants mêmes de la vraie tuile (`TileCompactEmpty`, `TodayHead` en `strut`, sans repère de test ni cible d'animation) : aucun texte visible, aucune valeur recopiée. Limites acceptées : (1) si les données ont changé depuis la dernière visite (dont un autre filtre d'espace), une tuile s'ajuste en hauteur à l'arrivée du contenu ; (2) pendant une navigation dans l'app, Next peut réutiliser un écran de chargement préchargé plus tôt, dont les hauteurs datent d'une visite précédente ; (3) relevé par palier, pas par largeur exacte : rouverte à une autre largeur du même palier, la grille peut se répartir autrement et les tuiles s'ajustent à l'arrivée du contenu. Mouvement réduit : voile fixe au repos du cran. Transparence réduite : le verre devient opaque, le voile reste. Accessibilité : `aria-busy` sur `<main>`, message en `role="status"`, givre `aria-hidden`.
- **Givre de la liste et de la corbeille** (QA-3 d'effets-de-verre, décision d'Antoine du 2026-11-21) : squelette générique, sans mémorisation, charte de la liste inchangée (titres sur deux lignes au plus). Dans la tuile de verre de la liste : un en-tête de section réservé, sans voile propre, puis six lignes givrées (`FrostTile`, variante `row` : surface `row` + voile). Corbeille : six lignes givrées, sans en-tête de section, comme la vraie page. Deux couches de voile : celui de la tuile, puis celui de chaque ligne (`--frost-index` 1 à 6, éclaircissement ligne par ligne). Chaque ligne a la hauteur d'une ligne au titre et à la légende sur une ligne ; ses classes et ses cales (`h-lh` aux tailles de texte réelles) viennent de `task-list-layout.ts` et `trash-list-layout.ts`, partagés avec les vrais composants. La légende d'une ligne de la liste a toujours la hauteur d'une pastille (cale invisible), avec ou sans pastille d'espace. En-tête de page, filtre d'espace, interrupteur « Terminées », premier en-tête de section et première ligne gardent leur place au pixel près ; sous la première ligne, un ajustement est accepté (titres sur deux lignes, nombre de lignes). Tant qu'un voile est affiché, le document n'ancre pas son défilement (`html:has(.frost)`) : le haut de page ne saute pas quand le contenu arrive.
- **Focus visible** : partout `outline 2px ring` décalé de 2 px (posé en base dans `globals.css`) ; sur la tuile pleine, `ring-on-primary`. Les primitives shadcn qui utilisent `ring-ring/50` passent à `ring-ring` plein (50 % tombe sous 3:1).

## 6. Grille bento et navigation
Mécanique de la référence : rangées `flex flex-wrap gap-grid`, sans `items-*` (alignement par défaut : les tuiles d'une rangée s'étirent à la plus haute), chaque tuile `min-w-0` avec une base de largeur, ce qui donne une colonne au téléphone sans point de rupture.

| Type de tuile | Base (`flex`) | Exemple |
| --- | --- | --- |
| Large | `2 1 400px` | Aujourd'hui, To-do, Budget |
| Standard | `1 1 240px` (220–260 selon le contenu) | Courses, Assurances |
| Chiffre | `1 1 140px` | Paire « Courses 3 » / « Budget 52 % » sur mobile |

- **390 px** : une colonne de tuiles ; seule une paire de tuiles « chiffre » partage une rangée (référence mobile). Coque : nom + pilule en haut, barre d'onglets en bas. `px-page` 16 px.
- **640–1023 px (tablette)** : deux tuiles standard par rangée, les larges sur toute la largeur ; navigation encore en barre d'onglets (le pouce reste la cible). `px-page` 24 px.
- **≥ 1024 px (ordinateur)** : en-tête en verre + barre latérale (≥ 240 px) + contenu (base 560 px) ; rangées de 2 à 3 tuiles en proportions 2:1 (`2 1 400px` + `1 1 230px`). Contenu ≤ 1400 px, centré.
- Autant de tuiles que de contenus ; jamais deux tuiles identiques côte à côte par défaut ; une tuile sans données montre son état vide.
- **Hauteur du contenu** (décision d'Antoine du 2026-11-23, QA-5 d'effets-de-verre ; remplace les hauteurs fixes de QA-2, qui laissaient des tuiles de près de 500 px pour une phrase) : aucune hauteur imposée à une tuile du tableau de bord. Rangées alignées en bas (décision d'Antoine du 2026-11-23, QA-6) : une rangée a la hauteur de sa tuile la plus haute, et les tuiles de la rangée s'y étirent (ordinateur et tablette ; la paire de tuiles chiffre au téléphone) ; en une colonne, chaque tuile a la hauteur de son contenu. Dans une tuile étirée, le contenu reste en haut et l'action du bas est poussée en bas (`mt-auto` dans un corps `flex-col`) : bouton « Ajouter une tâche » de la To-do vide, lien « Voir la to-do » de la tuile « Aujourd'hui » ; le lien « Tout voir » reste dans l'en-tête. Classes de place et de grille dans `src/components/bento/tile-sizes.ts`, partagées avec le givre de chargement (§ 5).
- **Une ligne dans les tuiles** : titre d'une ligne de tâche sur une ligne, tronqué par des points de suspension ; légende (côté, parente, espace, échéance, heure, tags, priorité, compteur) sur une ligne, coupée au bord ; pastilles d'espace de la tuile sur une ligne, tronquées. Le titre complet reste dans la liste et le détail (`TaskRow`, variante `tile` réservée aux tuiles). Les titres de tuile (`h3`) gardent la règle du § 3 (deux lignes plutôt que tronqués).
- **États vides compacts** : une tuile vide ou peu remplie a la hauteur de son message, sans blanc ajouté ni état de remplissage. Tuile de verre vide (`TileCompactEmpty`) : en-tête, espaces, puis le carré d'icône 44 px (`bg-row text-link`) et la phrase `text-small text-muted-foreground` côte à côte, la phrase passant sous l'icône quand la tuile est trop étroite (base 160 px) ; To-do vide : le bouton « Ajouter une tâche » dessous, poussé en bas si la rangée étire la tuile. Tuile « Aujourd'hui » sans rien de dû : date, salutation et « Rien en retard, rien de prévu aujourd'hui. » (`TodayHead`). Une To-do sous 5 tâches ou une tuile « Aujourd'hui » sous 3 tâches s'arrêtent après leur dernière ligne.
- Zones tactiles ≥ 44 px partout (onglets 52 px, ajout 56 px mobile). Actions fréquentes dans le tiers bas de l'écran sur mobile.
- Safe-area iOS : `viewport-fit=cover` et `env(safe-area-inset-*)` posés par la coque (tâches 13–14) : haut de page `max(16px, env(safe-area-inset-top))`, barre d'onglets ci-dessus, côtés en paysage.

## 7. Mouvement (ADR-006)
Une animation a une raison (hiérarchie, récit, feedback, état) ou elle saute. `transform` et `opacity` seulement ; on part toujours de la valeur affichée ; on ne bloque jamais l'input. Un élément n'est animé que par une bibliothèque : si une tuile est révélée par GSAP, son survol Motion s'applique à un enfant.

**Moments signature — GSAP**, dans `src/components/signature/`, chargés par `next/dynamic`, joués **une fois par session** (marqueur en `sessionStorage`), coupés par `gsap.matchMedia("(prefers-reduced-motion: reduce)")` qui pose l'état final sans transition :
| Moment | Effet | Durée, easing |
| --- | --- | --- |
| Entrée du tableau de bord | Tuile « Aujourd'hui » : `autoAlpha` 0 → 1, `y` 16 → 0 ; salutation puis intro en décalé | 0,6 s `power3.out`, décalage 0,08 s |
| Révélation de la grille | Tuiles : `autoAlpha` 0 → 1, `y` 24 → 0, dans l'ordre de lecture | 0,5 s `expo.out`, décalage 0,05 s, total ≤ 0,9 s, départ 0,15 s après la tuile pleine |
| Reflet (fin de la révélation) | Un calque balaie chaque tuile de verre de la grille, de gauche à droite (jamais la tuile pleine) : `xPercent` −110 → 110. Dégradé à 105° : `transparent` 30 %, `color-mix(in srgb, var(--halo-blue) 55%, transparent)` 45 %, `color-mix(in srgb, var(--halo-lilac) 55%, transparent)` 55 %, `transparent` 70 %. `transform` seulement, `pointer-events: none` ; jamais d'animation de `backdrop-filter` | 2,2 s `sine.inOut`, décalage 0,16 s, départ 0,1 s après la fin du mouvement de la dernière tuile |
| Bascule Privé / Pro (première de la session) | Pilule active glisse (`x`) ; tuiles du nouveau côté en fondu + `y` 8 → 0 | 0,4 s `power3.out` ; tuiles 0,25 s |
| Écrans vides | Icône, phrase, action : `autoAlpha` + `y` 12 → 0 en décalé | 0,4 s `power3.out`, décalage 0,06 s |

Reflet (BRAIN-33) : même marqueur de session que la révélation, jamais rejoué par une navigation. Halos fixes (`body::before`) : rien ne bouge derrière un verre visible pendant le reflet. L'animation des halos (direction « brume ») est abandonnée (2026-11-20).

**Interactions — Motion** (`motion/react`, racine en `<MotionConfig reducedMotion="user">`, `useReducedMotion` pour le reste) :
- Pression (boutons, lignes, onglets) : `scale` 0,97, 0,1 s ease-out, au `pointerdown`.
- Survol d'une tuile (pointeur fin seulement) : `y` −2, ressort `bounce: 0`, 0,3 s.
- Catégorie de la barre latérale : chevron 0 → 90°, 0,2 s `ease-out-expo` ; sous-liste en `opacity` + `y` −4 → 0, 0,2 s (pas d'animation de hauteur).
- Palette (⌘K) : `opacity` + `scale` 0,98 → 1, 0,2 s `ease-out-expo` ; fermeture 0,15 s. Voile `scrim` : `opacity` seule, mêmes durées et même courbe.
- Apparition / retrait d'un élément de liste : `opacity` + `y` 8, ressort `bounce: 0`, 0,3 s ; tiroir mobile : ressort `bounce: 0.2`, 0,3 s.
- Easing CSS commun : `--ease-out-expo` `cubic-bezier(0.16, 1, 0.3, 1)`.

Chaque module peut proposer ses propres moments signature, validés à sa spec, dans les mêmes règles.

**Règles** : gestes répétés (bascule, filtre, navigation) instantanés ; aucune boucle ; `prefers-reduced-motion` → fondus de 0,15 s au plus ou rien (filet global dans `globals.css`, plus les deux bibliothèques). États de chargement (givre) : keyframes CSS de `globals.css`, ni Motion ni GSAP, affichés avant l'hydratation ; joués à chaque chargement, ce n'est pas un moment signature. `tw-animate-css` reste limité à l'entrée / sortie des primitives de `src/components/ui/`, jamais sur un élément animé par Motion ou GSAP.

## 8. Décisions hors référence (validées par Antoine le 2026-11-12)
1. **Erreurs et actions destructives en braise** (`#8A3810`) : la référence n'a pas de rouge ; la braise est sa seule couleur chaude (« + 2 pts » au-dessus de la cible) ; amendée par la décision 11 (teintes de priorité, dont un rouge pastel). Elle sert aussi à la pastille Trustup : le texte d'erreur est toujours accompagné d'un libellé, jamais de la couleur seule.
2. **Bordure des champs en encre secondaire** : la bordure de la référence (encre 12 %) fait 1,26:1, sous les 3:1 exigés pour identifier un champ.
3. **Libellés des pastilles de chiffres en blanc plein** (référence : blanc 90 %, 4,03:1 sur la pastille, sous 4,5:1).
4. **Interligne du titre display 1,1** partout (référence ordinateur : 1,08) pour ne pas couper les capitales accentuées.
5. **Halos fixes** (ils défilent avec la page dans la référence) : fond stable, rendu moins coûteux ; dégradés radiaux plutôt que des disques floutés par `filter: blur`.
6. **Pilules sur du verre sous 1024 px** : mesuré sur capture réelle à la tâche 14, le texte inactif tombait sous 4,5:1 sur le fond nu (bascule mobile 4,45:1, filtre de contexte 3,60:1). Retenu : la bascule Privé / Pro est posée sur du verre sous 1024 px (au-dessus, l'en-tête est déjà en verre) ; mesuré ensuite ≥ 4,89:1 à 390 px et ≥ 5,02:1 à 1440 px. Filtre d'espace (2026-11-13) : sur ordinateur, dans la barre latérale en verre, sa piste n'en porte pas (texte inactif 4,82:1 calculé, 4,85:1 mesuré) ; sur mobile, une pastille en verre à côté du titre, texte en encre (≥ 14:1 mesuré). Jamais de verre sur du verre.
7. **Tablette** (absente de la référence) : deux colonnes, barre d'onglets conservée jusqu'à 1024 px.
8. **Icônes Lucide** (le skill cite Phosphor, Tabler ou Radix) : déjà fournie par shadcn, et les icônes de la référence en ont le dessin (trait 2, bouts arrondis).
9. **Mobile en une colonne avec une paire « chiffre »** : la spec dit une colonne, la référence mobile montre deux petites tuiles côte à côte. Retenu : une colonne, sauf la paire de tuiles chiffre.
10. **Voile `scrim` sous les fenêtres modales** (décision d'Antoine, 2026-11-16) : la référence n'a pas de fenêtre modale. Encre à 20 % (`rgb(27 32 51 / 0.2)`), à plat, jamais flouté (pas de verre sous une fenêtre opaque), posé à `--z-overlay` ; il apparaît et disparaît en fondu d'opacité 0,2 s, même courbe que la palette, sans échelle. Décoratif : aucun texte ne s'y pose.
11. **Teintes de priorité** (décisions d'Antoine, 2026-11-25) : la référence n'a que l'indigo et la braise. Quatre teintes pastel entrent dans la charte (§ 2), sur une échelle que tout le monde lit : rouge, orangé, jaune, vert. Urgente en rouge pastel : la décision 1 est amendée, la braise n'est plus la seule couleur chaude, mais elle reste le texte du retard et des erreurs ; les deux se distinguent par la forme (badge teinté à icône pour la priorité, texte sans fond pour le retard). L'icône du niveau reste, jamais la couleur seule. Valeurs validées par Antoine sur iPhone le 2026-11-26 (application : tâche 12 du plan todo-kanban).

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
- Les composants n'utilisent que les tokens sémantiques ; le sombre redéfinira ces mêmes noms (`--background`, `--foreground`, `--primary`, `--glass-bg`, `--glass-border`, `--glass-shadow`, `--row-bg`, `--on-primary-*`, `--track`, `--pill-track`, `--scrim`, `--chip-*`, `--priority-*`, `--halo-layers`…) sous `.dark` (variante déjà déclarée) ou `prefers-color-scheme: dark`, sans toucher aux composants.
- À ce moment : `color-scheme: dark`, `THEME_COLOR` par schéma (`themeColor` accepte une liste par `media`), mêmes exigences de contraste recalculées, et la tuile « Aujourd'hui » reste la seule tuile pleine.

## 11. Interdits
- Une couleur, une police, un rayon ou une ombre hors de ce fichier ; une valeur arbitraire en ligne (`#…`, `mt-[13px]`).
- Une deuxième tuile pleine ; du verre sur du verre ; une ombre noire.
- Du texte secondaire directement sur le cœur d'un halo ; du texte en dégradé.
- Une zone tactile sous 44 px ; un focus invisible ; un placeholder comme libellé.
- Une animation sur `width`, `height`, `top`, `left` ou `backdrop-filter` ; une boucle (un éclaircissement unique, comme le givre de chargement, n'en est pas une) ; un moment signature rejoué sur un geste répété.
