# Mouvement — physique et gabarits

Sources : skill `apple-design` d'Emil Kowalski (principes WWDC appliqués au web), skills officiels GSAP (`/plugin marketplace add greensock/gsap-skills` puis `/plugin install gsap-skills@gsap-skills`), Taste Skill v2 (gabarits). Une seule lib par arbre : la table du § 5 de SKILL.md dit laquelle.

## Principe directeur
Une interface est vivante quand le mouvement part de la valeur affichée à l'instant, hérite de la vitesse de l'utilisateur, projette l'élan, et peut être attrapé ou inversé à tout moment. On anime depuis la valeur courante, jamais depuis la cible, et on ne bloque jamais l'input pendant une transition.

## Bandes d'intensité (curseur MOTION)
| Bande | Ce qu'on fait | Outil |
| --- | --- | --- |
| 1–3 | États hover / active uniquement | CSS transitions 0.2–0.3 s, `cubic-bezier(0.16, 1, 0.3, 1)` |
| 4–7 | Entrée de page, révélations au défilement, CTA qui réagit | Motion (React) · `motion` vanilla (Astro) · Reanimated (Expo) |
| 8–10 | Épinglage, scrub, défilement horizontal, texte découpé, parallaxe | GSAP + ScrollTrigger (+ SplitText, gratuit depuis GSAP 3.13) |

## Ressorts (interactif, tous arbres)
- Deux nombres : **amortissement** (1.0 = pas de rebond ; 0.8 = léger rebond réservé aux gestes à élan) et **réponse** (secondes pour atteindre la cible).
- Valeurs Apple : déplacement 1.0 / 0.4 s · rotation 0.8 / 0.4 s · tiroir ou sheet 0.8 / 0.3 s.
- Pression : `scale: 0.97` ou `translateY(1px)` sur `:active`, 100 ms ease-out, déclenchée au `pointerdown`, pas au relâchement.
- Gestes : suivre 1:1 avec pointer capture, garder l'offset de saisie, transmettre la vitesse de relâchement au ressort. Hystérésis ≈ 10 px. Direction décidée par le signe de la vitesse, pas par la position.
- Élastique aux bornes : résistance progressive (constante 0.55), jamais un mur. Entrée et sortie par le même chemin ; `transform-origin` sur le déclencheur.

## Motion (React / Next)
```tsx
import { motion, MotionConfig } from "motion/react";
// à la racine de l'app : <MotionConfig reducedMotion="user"> … </MotionConfig>

// ressort par défaut
transition={{ type: "spring", bounce: 0, duration: 0.4 }}   // bounce 0.2 pour un flick

// révélation au défilement — le cas de 80 % des sites
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={{ duration: 0.6, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
/>
```
Valeurs continues (souris, progression) → `useMotionValue` / `useScroll`, jamais `useState`.

## Astro (sans React)
```ts
import { animate, inView, spring } from "motion";
inView(".reveal", (el) => { animate(el, { opacity: [0, 1], y: [24, 0] }, { duration: 0.6, easing: [0.16, 1, 0.3, 1] }); }, { amount: 0.3 });
animate(btn, { scale: 0.97 }, { type: spring, bounce: 0, duration: 0.4 });
```
Scripts dans `<script>` Astro, un par composant, nettoyés sur `astro:before-swap` si View Transitions.

## GSAP (preset agence, ou pin / scrub en React)
```tsx
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP, ScrollTrigger);          // une fois par app

useGSAP(() => { /* tweens scopés */ }, { scope: containerRef });   // revert automatique au démontage
const { contextSafe } = useGSAP({ scope: containerRef });          // pour les handlers d'événements
```
- Hors React : `const ctx = gsap.context(() => {...}, el)` et `ctx.revert()` au nettoyage.
- Timelines plutôt que `delay` chaînés ; `autoAlpha` plutôt que `opacity` seule ; `ScrollTrigger.refresh()` après un changement de layout ; easings `power3.out` (entrées), `expo.out` (révélations), `none` sous scrub.
- Gabarit pile de cartes épinglées : chaque carte sauf la dernière → `start: "top top"`, `pin: true`, `pinSpacing: false` ; la précédente passe à `scale 0.92`, `opacity 0.55`, pilotée par le trigger de la suivante, `ease: "none"`.
- Gabarit défilement horizontal : wrapper épinglé `start: "top top"`, piste translatée de la distance de débordement, `end: "+=distance"`, `scrub: 1`, `invalidateOnRefresh: true`, hauteur `100dvh`.
- Un seul bandeau défilant par page. Grain ou bruit uniquement sur un calque fixe `pointer-events-none`.

## Mobile (Expo / Dopamine)
Le skill `animate-expo` fait foi : Reanimated + Gesture Handler, mouvement hors du thread JS, haptique au bon moment, transitions d'écran. Les valeurs de ressort ci-dessus s'appliquent (damping / response → `withSpring({ damping, stiffness })` selon la conversion du skill).

## Matériaux et profondeur (apps, overlays)
- Translucide : `backdrop-filter: blur(20px) saturate(180%)`, fond blanc ≈ 0.6, bord supérieur clair. Jamais deux verres légers empilés ; plus la surface est grande, plus le flou et l'ombre sont forts.
- Modale = voile assombri ; panneau non bloquant = pas de voile ; sheets empilées assombrissent progressivement les parents.
- Texte sur verre : contraste plus fort, graisse +1, letter-spacing légèrement augmenté.

## Accessibilité et performance (toujours, quel que soit MOTION)
- `prefers-reduced-motion` : fondus à la place des glissements et ressorts, pas de dépassement, boucles / parallaxe / épinglage / magnétique → statique. Une seule media query ou `MotionConfig reducedMotion="user"`.
- `prefers-reduced-transparency` → surfaces opaques (support partiel : prévoir le repli). `prefers-contrast: more` → fonds pleins, bordures nettes.
- Animer `transform` et `opacity` seulement ; jamais `window.addEventListener('scroll')`.
- Cibles : LCP < 2.5 s (hero préchargé), INP < 200 ms, CLS < 0.1 (espace réservé images, polices, embeds).
- Vérifier le mouvement au ralenti (DevTools → Animations) avant de livrer.
