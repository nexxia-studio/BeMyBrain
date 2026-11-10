# Presets des curseurs par type de projet Nexxia

Format : VARIANCE / MOTION / DENSITY (1–10). Baseline générale 7 / 5 / 4. Un redesign « conserver » reprend l'existant avec MOTION +1 ; un redesign « refonte » ajoute +2 à VARIANCE et MOTION.

| Projet | Preset | Pourquoi | Système conseillé |
| --- | --- | --- | --- |
| Institut de beauté, spa (ex. Julie Meessen) | 6 / 4 / 2 | Calme, matière, beaucoup de blanc, photos qui respirent | Astro + Tailwind v4, composants maison, Motion pour les révélations |
| Centre médical, kiné (ex. G.Move) | 4 / 3 / 4 | Confiance d'abord : lisibilité, prise de RDV évidente, zéro gadget | Astro + Tailwind v4, formulaires soignés, motion feedback seulement |
| Artisan, construction | 5 / 4 / 4 | Solide et direct : preuves (chantiers, avis), contact en un clic | Astro + Tailwind v4, galerie réelle, CTA téléphone mobile |
| Agence / nexxia.pro | 9 / 8 / 3 | Vitrine du savoir-faire : asymétrie, défilement cinématique, typographie forte | Next ou Astro + GSAP ScrollTrigger ; React Bits uniquement les composants GSAP (SplitText…) |
| Landing SaaS (Viniz marketing) | 7 / 6 / 4 | Clarté de l'offre, preuve sociale, un seul CTA | Next + Tailwind v4 + shadcn personnalisé, Motion |
| App SaaS (Viniz produit) | 4 / 3 / 6 | Densité utile, états (vide / chargement / erreur), feedback immédiat | shadcn/ui personnalisé, Motion feedback, pas de scroll-trigger |
| App mobile (Dopamine) | 5 / 5 / 5 | Gestes 1:1, ressorts, zones tactiles ≥ 44 px, safe areas | Composants RN du projet, `animate-expo` (Emil), `mobile-native` |
| Boutique Shopify (thème) | 5 / 3 / 5 | La conversion prime : fiche produit lisible, panier sans friction | Thème Shopify, CSS natif, pas de framework JS ajouté |

## Règles de dérogation
- Un client qui demande « quelque chose de moderne » sans précision → preset du secteur, pas le preset agence.
- Un secteur réglementé ou un public âgé → MOTION max 3, DENSITY ≥ 4, contraste AAA sur les titres.
- Deux projets consécutifs ne partagent pas la même police display (à vérifier par Antoine, Claude n'a pas la mémoire des autres repos). La palette vient toujours de la charte du client.
