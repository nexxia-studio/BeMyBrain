## QA — effets-de-verre — 2026-11-23

Build de production locale (`pnpm build` puis `next start -p 3217`) sur `c4b626a` ; le commit `df274b2` arrivé pendant la session ne touche que des tests (`e2e/effets-de-verre.spec.ts`, `tests/design/frost.test.ts`). Scénario 7 rejoué aussi en dev (`next dev -p 3218`). Compte e2e de la branche Neon `dev`, Chromium, un worker. Ordinateur 1440 × 900, mobile 390 × 844 (émulation iPhone sous Chromium), tablette 820 × 1180 pour l'alignement des rangées.

Deux passes :
- `e2e/effets-de-verre.spec.ts` contre la build : 20/20 verts (ordinateur et mobile).
- Parcours QA indépendant (scripts hors dépôt), avec captures et mesures (`qa/mesures.jsonl`).

Captures et mesures : `docs/features/effets-de-verre/qa/` (ignoré par git), nommées `<largeur>-<scénario>-….png`.

| # | Scénario | Résultat | Preuve |
|---|---|---|---|
| 1 | Reflet à l'ouverture (+ mobile) | PASS | `1440-s1-reflet-en-cours.png`, `390-s1-reflet-en-cours.png`. 5 calques, 119 à 133 positions de −110 % à +110 %, retour à −110 %, `pointer-events: none`, aucun calque dans « Aujourd'hui ». |
| 2 | Pas de rejeu (+ mobile) | PASS | `1440-s2-retour.png`. 0 mouvement sur 5 s après liste → accueil, et sur 4 s après retour arrière / avant. |
| 3 | Mouvement réduit (+ mobile) | PASS | `1440-s3-immediat.png`. Tuiles à opacité 1 sans transform dès la 1re image ; calques `display: none`, 0 animation, 0 mouvement sur 5 s. |
| 4 | Givre du tableau de bord (+ mobile) | PASS | `*-s4-{private,pro}-{sans,avec}-cookie-{givre-debut,givre-repos,contenu}.png`. Titre visible pendant le givre ; `aria-busy="true"`, un `role=status`. Voile 1 → 0,55 tuile par tuile. Décalage cumulé 0. |
| 5 | Givre de la liste et de la corbeille (+ mobile) | PASS | `*-s5-liste-{givre,contenu}.png`, `*-s5-corbeille-{givre,contenu}.png`. Écart nul (< 0,5 px) entre givre et contenu pour l'en-tête, le filtre d'espace (mobile), « Terminées », le 1er en-tête de section et la 1re ligne. Corbeille : en-tête et 1re ligne identiques. |
| 6 | Givre en mouvement réduit | PASS | `1440-s6-dashboard.png`, `1440-s6-tasks.png`. Dès l'affichage, tous les voiles (tuiles et lignes) sont à 0,55, avec 0 animation. |
| 7 | Démo fermée | PASS | `1440-s7-demo-404.png`, `1440-s7-dev-demo-404.png`. `/demo/effets-de-verre`, `…/lent/tableau-de-bord`, `…/lent/taches` répondent 404, en build comme en dev. `/demo` aussi. |

### Points décidés le 2026-11-23

| Point | Résultat | Mesure |
|---|---|---|
| Tuiles à la hauteur du contenu, états vides compacts | PASS | Mobile : chaque tuile garde sa hauteur naturelle (Courses/Budget en paire, 224,7 px chacune). Tuiles vides de santé, maison, clients… à 145,8 px (mobile) et 159,1 px (ordinateur). |
| Rangées alignées en bas, action du bas en bas (ordinateur, tablette) | PASS | 1440 : bas des rangées à 594,5 et 773,7 px, côtés Privé et Pro. 820 : 951 / 1113,4 px (Privé) et 810,1 / 972,4 px (Pro). « Voir la to-do » à 28 px du bas et « Ajouter une tâche » à 25 px, To-do Pro étirée de 250 à 429 px. |
| Titres de tâche et pastilles sur une ligne | PASS | Contrôle visuel (`1440-s4-private-avec-cookie-contenu.png`, `390-s4-private-avec-cookie-contenu.png`) : titres coupés par « … », pastille, date et heure sur une ligne. Titres de tuile sur 2 lignes au plus (« Liste partagée » sur 2 dans la colonne étroite, admis). |
| Aucune césure automatique | PASS | 0 élément en `hyphens: auto`, à 390, 820 et 1440 px. |
| Givre au 1er passage sans cookie = état vide compact | PASS | Ex. 1440 Privé : 238 / 238 / 238 / 159,1 px, puis le contenu arrive à 429,4 px (ajustement attendu, limite 1). |
| 2e passage, données inchangées : boîtes identiques au pixel | PASS | Écart x, y, largeur, hauteur < 0,5 px pour chaque tuile, côtés Privé et Pro, à 390 et à 1440 px. |
| Ordre et largeur des tuiles constants | PASS | Mêmes ids, mêmes largeurs entre le passage compact et le 2e passage, puis entre givre et contenu. |
| Cookie `bmb-dashboard-tiles` | PASS | `Path=/dashboard`, `SameSite=Strict`, `Secure`, expiration à 30,00 jours. Valeur ex. `private.lg:today-42936_…`, `pro.sm:…`. |
| Intensité « discret », voile au repos à 0,55 | PASS | Opacité de chaque voile 3 s après l'affichage : 0,55 (tableau de bord, liste, corbeille). |
| Aucune durée minimale du givre | PASS | Sans retard : le givre disparaît 3 à 15 ms après la fin de la réponse RSC (tableau de bord : RSC 781 ms → givre retiré à 792 ms ; liste : 820 → 823 ms). |

### Échecs détaillés
- Aucun.
- Deux contrôles automatiques de mon script ont échoué à tort. Corrigés puis rejoués ou vérifiés à l'œil, ce ne sont pas des défauts :
  - comptage de lignes par `Range` : une pastille à marge interne et la date côte à côte comptent pour « 2 lignes » ;
  - sélecteur S6 : il visait le conteneur des lignes givrées (opacité 1), pas leur voile (0,55).

### Hors spec mais observé
1. **Givre et titre « To-do » en double pendant le chargement de la liste**, sur ordinateur comme sur mobile (`1440-s5-liste-givre.png`, `390-s5-liste-givre.png`). Un second titre et une seconde tuile givrée apparaissent sous la première, dans la fenêtre à 1440 px. Cause connue : le `loading.tsx` de `/tasks` est aussi rendu dans `@detail` (gotchas). Toléré par l'e2e (`.first()`) ; relève du ticket `loading.tsx` / `error.tsx` de `@detail`, encore à créer. Le plus visible des défauts relevés.
2. Session expirée (cookies effacés, puis clic sur Accueil) : arrivée sur `/login`, aucun givre resté affiché (`1440-s7-session-expiree.png`).
3. Retour arrière pendant le givre de la liste : retour propre au tableau de bord, aucun givre resté (`*-s5-retour-arriere.png`).
4. Console et réseau : aucune erreur console, aucune requête 4xx/5xx (hors 404 attendus du scénario 7) sur les scénarios 1 à 5.
5. Compte e2e : en plus des deux tâches en retard (BRAIN-52), la To-do Privée porte trois tâches laissées par d'anciens parcours e2e (« Préparer le déménagement mwo8… » ×2, « Panneau sous l'en-tête mwo8… »). Leurs titres ne correspondent à aucun parcours joué dans cette session. Les 6 tâches créées par la QA sont à la corbeille.
6. L'émulation iPhone tourne sous Chromium : le comportement réel de Safari iOS (composition du reflet, clavier) n'est pas couvert ici ; voir l'essai iPhone de la tâche 8.
