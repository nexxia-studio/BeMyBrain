# Plan — Effets de verre (BRAIN-33)

**Statut** : terminé, fusionné dans `main` le 2026-11-23 (PR #11, commit de fusion `171e064`). QA : `qa-report.md` (7 scénarios PASS).
**Spec** : `spec.md` · **Créé le** : 2026-11-20

Aucune nouvelle dépendance : GSAP, `@gsap/react` et Motion étaient déjà là. Le givre est en CSS pur.
Bascule Privé / Pro : abandonnée par Antoine le 2026-11-20 (aucun effet ajouté).

Valeurs retenues (spec, issues de la démo jouée sur iPhone) :
- **Reflet** : 2,2 s par tuile, décalage 0,16 s, `sine.inOut`, `xPercent` de −110 à 110, départ 0,1 s après la dernière tuile.
- **Givre** : dégradé à 135°, de `--halo-blue` à `--halo-lilac`. Cran par défaut de l'app : discret (repos 0,55) ; moyen (0,6) et marqué (0,65) disponibles. Opacité de 1 vers le repos, 1,3 s par tuile, 0,18 s de décalage, aucune boucle.

## En cours
Rien.

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. Une ligne par tâche. -->
- [x] **1. DESIGN.md amendé pour le reflet et le givre** — 2026-11-20 — `30f7e24`
- [x] **2. Composant givre (CSS pur)** `FrostTile`, utilitaire `frost` — 2026-11-20 — `78ff4f0`
- [x] **3. Givre au chargement du tableau de bord** — 2026-11-20 — `a636776`
- [x] **4. Givre au chargement de la liste et de la corbeille** — 2026-11-20 — `a86e7f1`
- [x] **5. Reflet à la fin de la révélation de la grille** — 2026-11-20 — `8a416ae`
- [x] **6. Démo d'essai iPhone** `[security]` — 2026-11-20 — `3411c25`, `508988b` (retirée à la tâche 9)
- [x] **7. e2e givre sans décalage, reflet une fois par session** — 2026-11-20 — `a21411c`
- [x] **8. Essai sur l'iPhone d'Antoine** — validé par Antoine le 2026-11-23 (aucun commit)
- [x] **9. Suppression de la page de démo** (`/demo/effets-de-verre`, routes lentes, cookie de démo) — 2026-11-23 — `c4b626a` — `/demo` en 404

### Corrections QA
- [x] **QA-1. Givre à trois crans, réglage dans la démo** — 2026-11-21 — `109481b` (réglage retiré à la tâche 9)
- [x] **QA-2. Hauteurs fixes par tuile** — 2026-11-21 — `e5cface` (retiré par QA-5)
- [x] **QA-3. Liste et corbeille : givre générique, haut de page immobile** — 2026-11-21 — `42a7b0a`
- [x] **QA-4. Coupure de connexion pendant une lecture** `[security]` (écouteur d'erreur permanent sur chaque connexion du pool) — 2026-11-23 — `a5d3119`, `900e09d`, `aff77b6`. Audit : une faille corrigée. Durcissements : BRAIN-51. Connexions mortes après veille : BRAIN-50.
- [x] **QA-5. Tuiles à la hauteur de leur contenu, états vides compacts, cran « discret », sans césure** — 2026-11-23 — `24617d1`. Grille `items-start` remplacée par QA-6.
- [x] **QA-6. Hauteurs des tuiles mémorisées dans un cookie, rangées alignées en bas** `[security]` — 2026-11-23 — `53e0f02`, `67a559c`. Audit sans faille. Durcissements : BRAIN-53.

### Suites hors de cette feature
- BRAIN-47 : `error.tsx` et `loading.tsx` dans `tasks/@detail`.
- BRAIN-54 : même cause (`@detail`).
- BRAIN-52 : isolation de l'e2e `todo-aujourdhui` (rouge).
- BRAIN-49 : durcissements sécurité (existant).
