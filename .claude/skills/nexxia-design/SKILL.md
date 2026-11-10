---
name: nexxia-design
description: Direction artistique et méthode front-end « signature Nexxia » pour créer ou refondre une UI — page de site vitrine, landing, écran Viniz ou Dopamine, section Shopify. Se déclenche quand une interface est conçue ou retravaillée, pas pour un correctif ponctuel (libellé, couleur, bug CSS). Complète Impeccable (DESIGN.md / PRODUCT.md) ; ne le remplace pas.
---

# Nexxia Design

Tu produis des interfaces qu'un client belge ou français paie pour avoir, pas ce qu'un modèle sort par défaut. Impeccable tient la charte (`DESIGN.md`) et le contexte produit (`PRODUCT.md`) ; ce skill tient la méthode et le goût. Lis les deux fichiers d'abord. Sans `PRODUCT.md` → demande `/impeccable init`. Sans `DESIGN.md` (client dont le logo n'est pas encore reçu) → travaille avec des tokens marqués `provisoire` et dis-le ; `/impeccable document` viendra après.

## 1. Lecture du brief (avant tout code)
Une ligne : **type de page · audience · ambiance · système**. Exemple : « Landing institut de beauté · femmes 30–55 Liège · calme et premium · Astro + Tailwind v4 + composants maison ».
- Réflexes par secteur Nexxia : beauté → calme, matière, photos réelles ; santé / kiné → confiance, lisibilité, zéro gadget ; construction / artisans → solide, direct, preuves ; SaaS Viniz / app Dopamine → densité utile, états clairs, feedback immédiat.
- Une question seulement si la lecture diverge du brief. Accessibilité, secteur réglementé ou public âgé priment sur l'esthétique.

## 2. Trois curseurs (1–10), écrits en commentaire en tête de la page ou de l'écran
`VARIANCE` (symétrique → asymétrique) · `MOTION` (statique → cinématique) · `DENSITY` (aéré → compact). Presets par projet dans `references/presets.md` ; un curseur non justifié = baseline du preset. Chaque section multi-colonnes déclare toujours son repli sous 768 px.

## 3. Verrous de page (un choix, tenu partout)
Un thème (clair, sombre ou auto, jamais inversé entre sections) · un accent · une famille de gris · un système de rayons (net, doux 12–16 px, pilule) · une famille d'icônes (Phosphor, Tabler ou Radix, trait 1.5 ou 2) · **une bibliothèque d'animation par arbre** (voir § 5). La charte du client dans `DESIGN.md` prime sur toute règle de couleur générique.

## 4. Composants : sourcer avant d'écrire
1. Ce qui existe dans le repo (`DESIGN.md` → composants).
2. shadcn/ui personnalisé aux tokens, jamais à l'état brut.
3. Registres : React Bits (`npx shadcn@latest add @react-bits/<Nom>-TS-TW`) pour texte animé, fonds, micro-interactions ; 21st.dev pour sections marketing ; SVGL / Simple Icons pour les logos réels. **Vérifier les imports** : on ne prend que les composants dont la lib d'animation est celle de l'arbre ; sinon on porte ou on refait.
4. À la main seulement si rien ne colle. Un composant importé est réaligné sur `DESIGN.md`.

## 5. Mouvement — une lib par arbre, choisie selon le projet
| Arbre | Lib | Gabarit |
| --- | --- | --- |
| React / Next (Viniz, landing) | Motion (`motion/react`) ; GSAP seulement pour pin, scrub, défilement horizontal | `references/motion.md` § Motion |
| Astro (sites vitrine) | `motion` vanilla (`animate`, `inView`) ou GSAP pour le preset agence | `references/motion.md` § Astro / GSAP |
| Expo (Dopamine) | skill `animate-expo` (Reanimated, gestes hors thread JS) | `references/motion.md` § Mobile |
| Thème Shopify | CSS transitions, pas de lib ajoutée | — |

Chaque animation a une raison en un mot (hiérarchie, récit, feedback, état) ou elle saute. Dès MOTION 4, la page doit visiblement bouger (entrée, révélations, hover CTA) ; `prefers-reduced-motion` est géré **toujours**, quel que soit le curseur. Physique, valeurs et gabarits dans `references/motion.md`.

## 6. Typo, layout, contenu — décisions
- Titres display : `tracking-tighter`, `leading-tight` (les accents français se coupent avec `leading-none`). Corps ≤ 65ch. Tailles fluides via un token `@theme` Tailwind v4, pas de valeur arbitraire en ligne.
- Hero : titre ≤ 2 lignes, sous-texte ≤ 20 mots, CTA visibles sans défiler, ≤ 4 éléments texte, logos clients sous le hero.
- Jamais deux sections de la même famille de layout d'affilée. Bento : autant de cellules que de contenus.
- Images réelles ou emplacements nommés par section. Copy en français relue chaîne par chaîne.
- Tout le reste (interdits, défauts de modèle) : `references/anti-slop.md`.

## 7. Avant de livrer
Passer `references/anti-slop.md`, puis `/impeccable critique` sur l'écran. Un point rouge = on corrige avant de montrer à Antoine.
