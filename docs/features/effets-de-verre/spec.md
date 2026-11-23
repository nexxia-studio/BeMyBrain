# Spec — Effets de verre (BRAIN-33)

**Créée le** : 2026-11-20 · **Statut** : validée (2026-11-20) · **Plan** : `plan.md`

Directions jouées sur iPhone avec la démo de la PR #11 (preview, 2026-11-20) :
- C · Reflet, vitesse lente, retenu pour l'ouverture.
- B · Givre, intensité marquée, retenu pour l'attente.
- A · Brume, abandonnée.

## Objectif
Donner au tableau de bord un moment d'ouverture propre au liquid glass : le reflet. Donner à toute l'app une seule façon d'attendre : le givre. Les deux doivent rester fluides sur iPhone.

## Hors périmètre
- Liste, ajout rapide, détail, corbeille : aucun reflet. La corbeille reçoit seulement le givre de chargement, à la place de son squelette.
- Tout effet lié au défilement.
- Animation des halos (direction A abandonnée) : les halos restent fixes dans `body::before`.
- Bascule Privé / Pro : le moment existant (pilule + fondu des tuiles) ne change pas ; aucun effet de verre ajouté (décision d'Antoine, 2026-11-20).
- Chargement du détail d'une tâche (`@detail`) : il n'a pas de squelette aujourd'hui. Il recevra le givre avec le ticket `error.tsx`/`loading.tsx` de `@detail`.
- Toute couleur, police, ombre ou dépendance nouvelle.

## Critères d'acceptation

### Reflet à l'ouverture du tableau de bord
- [ ] Première ouverture du tableau de bord dans la session : les tuiles se révèlent comme aujourd'hui (entrée puis révélation). Puis un reflet teinté bleu-lilas balaie chaque tuile de verre, de gauche à droite.
- [ ] Le balayage démarre 0,1 s après que la dernière tuile a fini de bouger. Rien ne bouge derrière un verre visible pendant le reflet : halos fixes, tuiles immobiles.
- [ ] Valeurs du balayage :
  - durée 2,2 s par tuile ;
  - décalage de 0,16 s entre tuiles ;
  - courbe `sine.inOut` ;
  - déplacement `xPercent` de −110 à 110 ;
  - dégradé à 105° : transparent 30 %, `--halo-blue` 55 % à 45 %, `--halo-lilac` 55 % à 55 %, transparent 70 %.
- [ ] Le reflet ne passe que sur les surfaces `.glass` de la grille, jamais sur la tuile pleine « Aujourd'hui ».
- [ ] Une fois par ouverture de l'app : le reflet est lié à la révélation et partage son marqueur `sessionStorage`. Une navigation vers le tableau de bord dans la même session ne le rejoue pas.
- [ ] Le reflet s'anime en `transform` seulement, sur un calque composé dès sa création. Il n'anime jamais `backdrop-filter` et ne crée pas de verre sur du verre.
- [ ] Il ne bloque jamais l'interaction (`pointer-events: none`). Le survol (Motion) reste sur un autre élément que celui animé par GSAP.
- [ ] Quitter le tableau de bord pendant le balayage : plus aucun calque ni style posé par le moment ne reste.
- [ ] « Réduire les animations » actif : aucun reflet, aucun calque visible ni animé, la grille est dans son état final.
- [ ] GSAP reste hors du bundle initial : le test de bundle existant reste vert.

### Givre de chargement
- [ ] Le chargement du tableau de bord, de la liste des tâches et de la corbeille affiche :
  - le vrai titre de la page ;
  - des tuiles givrées aux dimensions et positions des vraies tuiles ;
  - aucune barre de texte simulée (les lignes givrées de la liste et de la corbeille, QA-3, sont des surfaces de ligne voilées, pas des squelettes).
- [ ] Un seul composant givre réutilisable, rendu par le serveur, sans JavaScript client. Il s'affiche avant le reste du code.
- [ ] Le givre est un voile teinté posé dans la tuile de verre (jamais un second verre) :
  - dégradé à 135°, de `--halo-blue` à `--halo-lilac`, halos purs, cran « discret » (QA-1, retenu le 2026-11-23) ;
  - départ opaque (1), puis éclaircissement tuile par tuile jusqu'à un voile de repos qui reste ;
  - 1,3 s par tuile, 0,18 s de décalage ;
  - aucune boucle.
- [ ] La tuile pleine « Aujourd'hui » garde sa couleur primaire, vide, à ses dimensions réelles, sans voile.
- [ ] « Réduire les animations » actif : voile fixe au niveau de repos, sans mouvement.
- [ ] Aucun décalage de mise en page entre le givre et le contenu réel, sur mobile (390 px) et ordinateur (1440 px) :
  - tableau de bord : même position et même largeur du titre et de la première tuile ;
  - score de décalage cumulé (CLS) mesuré < 0,01.
- [ ] Liste des tâches et corbeille (QA-3, décision d'Antoine du 2026-11-21) : givre générique, sans mémorisation, charte de la liste inchangée (titres sur deux lignes au plus) :
  - liste : un en-tête de section réservé (sans voile propre), puis six lignes givrées à la hauteur d'une ligne dont le titre et la légende tiennent sur une ligne ; corbeille : six lignes givrées à la hauteur d'une tâche à la corbeille au titre sur une ligne (pastille de côté, date) ;
  - dimensions lues dans les classes partagées avec les vrais composants (`task-list-layout.ts`, `trash-list-layout.ts`), jamais recopiées ;
  - deux couches de voile : la tuile, puis chaque ligne (variante `row` de `FrostTile`) ;
  - la légende d'une ligne de la liste a la hauteur d'une pastille, avec ou sans pastille d'espace (cale invisible) : la première ligne est au pixel dans les deux cas ;
  - boîte (x, y, largeur, hauteur) identique au pixel près, du givre au contenu, pour l'en-tête de page, le filtre d'espace, l'interrupteur « Terminées », le premier en-tête de section et la première ligne (corbeille : en-tête de page et première ligne) ;
  - sous la première ligne, un ajustement est accepté (titres sur deux lignes, légende plus haute, nombre de lignes) : le bas de la liste n'est pas vérifié. Pour ces deux pages, ce critère remplace « même position et même largeur du titre et de la première tuile ».
- [ ] Tableau de bord (QA-5 et QA-6, décision d'Antoine du 2026-11-23, remplace QA-2 : les hauteurs fixes laissaient des tuiles de près de 500 px pour une phrase) :
  - les tuiles s'adaptent à leur contenu ; aucune hauteur fixe ; titres de tâche et pastilles sur une ligne dans les tuiles (titre complet dans la liste et le détail) ;
  - états vides compacts : une tuile vide ou peu remplie a la hauteur de son contenu, sans blanc ajouté ni état de remplissage ;
  - le givre réserve la hauteur mesurée de chaque tuile au dernier affichage, mémorisée dans un cookie par côté (Privé / Pro) et par palier d'écran, lue par le serveur au rendu de `loading.tsx` (aucun script, aucun éclair) ; sans relevé (première ouverture, nouvel appareil, nouveau palier), le givre prend la hauteur de l'état vide compact ;
  - le cookie est une donnée non fiable : valeurs converties en nombre et bornées, tuiles inconnues et cookie trop long ignorés, avant tout usage dans un style ;
  - test de géométrie, données inchangées depuis la visite précédente : boîte de chaque tuile identique au pixel, du givre au contenu, sur mobile et ordinateur ; dans tous les cas, l'ordre et la largeur des tuiles ne changent jamais ;
  - limites acceptées : (1) si les données ont changé depuis la dernière visite (dont un autre filtre d'espace), une tuile s'ajuste en hauteur à l'arrivée du contenu ; (2) pendant une navigation dans l'app, Next peut réutiliser un écran de chargement préchargé plus tôt, dont les hauteurs datent alors d'une visite précédente.
- [ ] Accessibilité inchangée : `aria-busy` sur `<main>`, message « chargement » en `role="status"`, givre `aria-hidden`.
- [ ] Les squelettes actuels et leurs `data-testid` sont retirés. Leurs tests sont remplacés.

### Charte et démo
- [ ] DESIGN.md amendé :
  - la ligne « Effets de verre » du § 7 devient « Reflet », avec les valeurs retenues ;
  - la phrase « reportés… » est retirée ;
  - le givre de chargement est décrit avec ses valeurs ;
  - § 11 : le givre n'est pas une boucle.
- [ ] Aucune césure automatique dans les textes de l'interface (`hyphens: auto` retiré, décision d'Antoine du 2026-11-23 : « aujourd'-hui » coupé dans la tuile pleine).
- [ ] Avant l'essai iPhone, la démo offre :
  - un bouton qui efface les marqueurs de session des moments, puis ouvre le tableau de bord ;
  - des liens vers le tableau de bord et la liste des tâches avec un chargement ralenti de 3 s, sur les vraies pages et les vrais composants de chargement.
- [ ] À la dernière tâche, plus rien ne reste de la démo :
  - ni la route, ni `glassDemo` dans les messages ;
  - ni `glass-demo-stage.tsx`, ni `demo-access.ts`.

## Scénarios utilisateur (joués par /qa)
1. **Reflet à l'ouverture** : Antoine ouvre l'app sur le tableau de bord, avec une session neuve. La grille se révèle, puis le reflet balaie les tuiles de verre et disparaît. Variante mobile : oui.
2. **Pas de rejeu** : depuis le tableau de bord, Antoine va sur la liste puis revient. La grille s'affiche sans révélation ni reflet. Variante mobile : oui.
3. **Mouvement réduit** : avec « réduire les animations », Antoine ouvre une session neuve. Grille immédiate, aucun reflet, aucun calque visible ni animé. Variante mobile : oui.
4. **Givre du tableau de bord** : chargement ralenti (requête retardée dans Playwright). Le givre s'affiche avec le titre, s'éclaircit tuile par tuile, puis le contenu le remplace sans décalage. Variante mobile : oui.
5. **Givre de la liste et de la corbeille** : même parcours sur `/tasks` et `/trash`, avec plusieurs sections, des titres longs et des tâches à la corbeille. En-tête, filtre, interrupteur, premier en-tête de section et première ligne ne bougent pas ; le bas de la liste peut s'ajuster. Variante mobile : oui.
6. **Givre en mouvement réduit** : le voile s'affiche directement à son niveau de repos, sans transition. Variante mobile : non.
7. **Démo fermée** : `/demo/effets-de-verre` répond 404 après la dernière tâche, en dev comme en build. Variante mobile : non.

## Données et sécurité
- Tables touchées : aucune. Ni migration, ni lecture, ni écriture nouvelles.
- RLS : sans objet.
- Argent / paiement : non.
- Pages de démo : fermées en production (`isGlassDemoEnabled`, tests existants). Les routes de chargement ralenti suivent la même garde et appellent `requireSessionWithToken` comme les vraies pages.
- Rappel ADR-010 : la preview est une copie de la production. Antoine s'y connecte avec son compte de production.

## UI
- Écrans concernés :
  - tableau de bord (moment d'ouverture, chargement) ;
  - `/tasks` et `/trash` (chargement) ;
  - démo temporaire.
- Maquette : la démo de la PR #11 (directions C et B).
- Contraintes DESIGN.md :
  - § 7 : `transform` et `opacity` seulement, une bibliothèque par élément, une fois par session ;
  - § 11 : pas de verre sur du verre, pas de boucle, pas d'animation de `backdrop-filter` ;
  - tokens `--halo-blue`, `--halo-lilac`, `--popover`, `--glass-*` ;
  - `prefers-reduced-transparency` : le verre devient opaque, le voile reste.

## Questions ouvertes
- [x] Intensité du givre : « discret » (repos 0,55, halos purs) pour toute l'app, choisi aux essais iPhone d'Antoine du 2026-11-23 (liste, puis tableau de bord). Les crans moyen et marqué disparaissent avec la démo.
- [x] Bascule Privé / Pro : pas d'effet de verre (Antoine, 2026-11-20).
