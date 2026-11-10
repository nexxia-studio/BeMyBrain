# Anti-slop — ce qu'un modèle produit par défaut et qu'on ne livre pas

Source principale : Taste Skill v2 (Leonxlnx), recoupée avec le détecteur Impeccable (59 contrôles). À passer avant chaque livraison d'UI. Un item coché = on corrige, pas on explique.

## Structure et layout
- [ ] Hero centré sur fond dégradé flou sombre (« mesh », aurora).
- [ ] Trois cartes de fonctionnalités identiques en ligne.
- [ ] En-tête scindé (titre à gauche, explication à droite) : empiler verticalement, corps ≤ 65ch.
- [ ] Deux sections de la même famille de layout d'affilée (zigzag image-texte compris).
- [ ] Bento avec cellules vides ou toutes identiques.
- [ ] Cartes utilisées pour tout : réserver l'élévation à une vraie hiérarchie, sinon bordures ou espace.
- [ ] `h-screen` sur un hero (→ `min-h-dvh`).
- [ ] Nav de plus de 80 px de haut ou sur deux lignes.

## Décoration parasite
- [ ] Étiquettes de version (v0.6, BETA), numéros de section en surtitre, « scroll pour découvrir », bandeaux météo / localisation.
- [ ] Plus d'un surtitre toutes les trois sections.
- [ ] Pastilles sur les images, points de statut décoratifs, chaînes de « · » séparateurs, « Étape 1 / Étape 2 » génériques, libellés poétiques (« Carnet de bord »).
- [ ] Filets décoratifs, viseurs, barres de progression à piste pleine.
- [ ] Texte vertical pivoté hors brief agence explicitement expérimental.
- [ ] Logos clients dans le hero (→ sous le hero, SVG réels, sans catégories).
- [ ] Faux dashboards ou captures en `div` ; SVG décoratifs dessinés à la main.
- [ ] Emojis hors brief explicitement ludique.

## Couleur et typo
- [ ] Dégradé violet, texte en dégradé, glassmorphism partout.
- [ ] Inter + slate-900 par réflexe ; Fraunces ou Instrument Serif par défaut.
- [ ] Deux accents, deux familles de gris, deux systèmes de rayons sur une même page.
- [ ] Sections qui inversent le thème (clair → sombre → clair).
- [ ] Noir `#000` ou blanc `#fff` purs hors charte client ; ombres noires pures sur fond clair (→ teintées).
- [ ] Palette beige / laiton / bordeaux / espresso « premium » par défaut.
- [ ] Bouton fantôme sur photo sans voile ni contour.

## Mouvement
- [ ] Micro-animations en boucle sans raison ; plus d'un bandeau défilant.
- [ ] Animation sur `width`, `height`, `top`, `left` (→ `transform` / `opacity`).
- [ ] `window.addEventListener('scroll')` ; boucle `requestAnimationFrame` qui touche l'état React.
- [ ] GSAP et Motion mélangés dans le même arbre.
- [ ] Transition qui démarre de la valeur cible au lieu de la valeur affichée.
- [ ] Pas de repli `prefers-reduced-motion` (obligatoire quel que soit MOTION).

## Copy (français)
<!-- Exemptés : les `h2` en forme de question, les réponses directes sous ces titres et les blocs FAQ (structure imposée par nexxia-seo § 3). -->
- [ ] Tirets cadratins décoratifs dans l'UI (titres, listes, CTA) : virgule, deux-points ou point.
- [ ] « Quietly trusted by », « Jane Doe », « Acme », pourcentages faussement précis.
- [ ] Verbes de remplissage : « sublimer », « propulser », « révéler votre potentiel », « seamless ».
- [ ] Deux CTA avec deux libellés pour la même intention (« Contactez-nous » et « Prendre contact »).
- [ ] Titre de section > 8 mots ; paragraphe > 25 mots ; citation > 3 lignes sans nom ni rôle.
- [ ] Chaîne visible non relue : faute, référence floue, jeu de mots mignon.

## États et accessibilité
- [ ] Composant interactif sans état vide, chargement (placeholder à la forme du contenu, pas de spinner) ou erreur.
- [ ] Placeholder utilisé comme label ; erreur affichée ailleurs que sous le champ.
- [ ] Contraste < 4.5:1 sur du texte de corps, < 3:1 sur du grand texte ; focus ring absent.
- [ ] Zone tactile < 44 px en mobile.
- [ ] Dark mode non testé alors que le thème est « auto ».
