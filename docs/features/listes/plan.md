# Plan — Listes : Courses, Wishlist, Bucket List (BRAIN-9, BRAIN-10)

**Spec** : `spec.md` (validée le 2026-11-28) · **Branche** : `feat/listes` · **Créé le** : 2026-11-28 · **Statut** : à relire par Antoine, rien d'exécuté

<!-- Une tâche = 1–2 h max, un seul implementer, un seul commit. Si une tâche dépasse, découpe-la. -->
<!-- [security] = relue seule, puis security-auditor après le reviewer. Toute migration et toute fonction ou action qui écrit est [security]. -->

## Livraison en trois PR (spec, Q10)
- **PR A — tâches 1 à 17** : base commune + Courses sans partage. Aucune route publique. Branche `feat/listes` (la PR est ouverte sur accord d'Antoine, après la suite complète).
- **PR B — tâches 18 à 35** : partage par lien + temps réel. Branche `feat/listes-partage`, partie de `main` après la fusion de A. À relire attentivement et à fusionner seule : dépendances, rôle Postgres, secrets Vercel, règle de pare-feu. **Bloquée tant que les gestes d'Antoine de la tâche 18 ne sont pas faits** ; si c'est le cas, passer à la PR C sans rien changer.
- **PR C — tâches 36 à 49** : Wishlist + Bucket List. Branche `feat/listes-envies`, partie de `main`. Indépendante de B (permutation possible), sauf la tâche 48 qui complète le contrôle segmenté.
Ordre : A → B → C, permutation B ↔ C permise.
Numérotation des migrations : 0011 (A), 0012 et 0013 (B), 0014 (C) ; si B et C se permutent, renuméroter par `pnpm db:generate` au moment de la seconde.

## Règles communes à toutes les tâches
- TDD : le test d'abord, rouge, puis le code (skill `test-driven-development`). Tests ciblés pendant une tâche (`pnpm vitest run <fichier>`, e2e du fichier concerné) ; suite complète (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e`) une seule fois, avant chaque PR. `pnpm lint` est rouge à cause de `qa-screenshots/` (gotcha) : le supprimer avant, le dire dans le rapport.
- **Migrations** : additives et rétrocompatibles (l'ancien code tourne sur le nouveau schéma, `.claude/rules/neon.md`), générées par `pnpm db:generate` (fichier SQL écrit à la main avec `--custom` pour rôle et fonctions), jamais appliquées à la main. **Aucun `pnpm db:migrate:test` ni `pnpm db:migrate` avant la fusion de la PR qui porte la migration** (gotcha et décision d'Antoine) : la migration se prouve sur la base éphémère du job « Tests » de la CI. En local, les tests de base restent rouges jusqu'à la CI, et le rapport de la tâche le dit. Les tests purs (sans base) se jouent en local.
- RLS : `ENABLE ROW LEVEL SECURITY` dans la migration qui crée la table, une policy par verbe, GRANT par colonne, index sur chaque FK et sur `(workspace_id, …)`, ordre des migrations tables → fonctions → policies (gotchas). Test d'isolation à deux workspaces par module, helpers dans `tests/factories/`.
- Argent en entiers `_cents`, enums en `CHECK`, `workspaceId` toujours issu de la session, jamais d'un paramètre.
- Aucune lecture ni écriture de base hors des fonctions de `src/modules/<module>/` ; lectures dans `queries.ts` (ADR-004) ; actions déclarées par `defineAction` (ADR-009).
- Aucun texte en dur : tout passe par `messages/{fr,en}.json` (ADR-007) ; les tests `tests/i18n/` doivent rester verts. Mobile d'abord (390 px), zones tactiles ≥ 44 px (ADR-008).
- **Nouvelle dépendance** seulement aux tâches 26 (QR) et 30 (Ably), avec la justification écrite dans le commit et dans la tâche : version publiée depuis plus de 14 jours, **jamais d'exclusion `minimumReleaseAgeExclude`** (gotcha), build scripts déclarés dans `allowBuilds` si besoin, taille mesurée, chargement différé vérifié par `pnpm test:build`. Aucune autre dépendance (pas d'analyseur HTML : balises `<meta>` lues dans le début de la page).
- Aucun secret affiché : sorties de commandes qui touchent une base masquées par `sed`, jamais d'URL de connexion, d'hôte `ep-`, de mot de passe, de clé ou de jeton dans une sortie, un commit, un test ou la mémoire (gotchas, `no-secret-output`). Variables d'environnement par nom seulement.
- Commits de chemins précis (`git add -- <fichiers>` puis `git commit -- <fichiers>`), jamais `git commit -a` ; crochets de pathspec : `':(literal)…'`. Messages en français. Push libre sur la branche ; `main` et PR sur accord.
- Processus d'arrière-plan fermés en fin de tâche (attendre par PID, jamais `pgrep -f`). e2e : `--workers=1`, `--project=desktop --project=mobile` puis `--project=langue --no-deps`, serveur `next start` sur port libre, jamais de build pendant un dev actif.
- Relecture **par bloc** de tâches, **une par une** pour les `[security]` et celles qui portent une migration. Une faille se corrige dans la tâche ; un durcissement va en ticket.
- Clavier iOS, glisser, CSP, `cn` et autres pièges d'UI : relire `docs/gotchas.md` avant chaque tâche d'écran ; l'iPhone juge (la jsdom et Playwright ne voient ni le clavier ni le toucher).

## Gestes d'Antoine (hors code, à faire avant la tâche indiquée)
- **Avant la tâche 18 (PR B)** :
  1. Créer le compte Ably et **deux applications** : une pour la production, une pour les previews et le local ; créer une clé d'API serveur par application ; les ranger dans 1Password ; poser la clé de l'application « production » dans Vercel en **Production seulement**, celle de l'application « previews et local » en **Preview seulement** (et dans `.env` pour le local), toutes deux sous `ABLY_API_KEY`, sensible. Jamais dans un fichier du dépôt.
  2. **Créer `SHARE_TOKEN_KEY`** (jamais affichée) :
     - Terminal : `openssl rand -base64 32 | tr -d '\n' | pbcopy` → la clé (32 octets en base64, 44 caractères, sans retour à la ligne) est dans le presse-papiers, rien n'est imprimé.
     - 1Password : nouvel élément « BeMyBrain — SHARE_TOKEN_KEY (production) », coller dans le champ mot de passe.
     - Vercel → projet `bemybrain` → Settings → Environment Variables → Add : nom `SHARE_TOKEN_KEY`, valeur collée, environnement **Production seulement** (décocher Preview et Development), **Sensitive** activé → Save.
     - Vider le presse-papiers : `pbcopy < /dev/null`.
     - Vérifier par `vercel env ls production` (nom seulement) ; ne jamais lancer `vercel env pull`. Aucune clé dans les previews ni dans la CI : voulu (spec).
     - Local (base `dev`) : clé jetable, sans l'afficher : `printf 'SHARE_TOKEN_KEY=%s\n' "$(openssl rand -base64 32 | tr -d '\n')" >> .env`.
     - Perdue ou changée : les liens existants deviennent illisibles, la feuille « Partager » affiche « Lien actif — régénérer pour l'afficher ici » ; rien ne casse.
  3. Autoriser la pose de `DATABASE_GUEST_URL` (production et previews) quand la tâche 22 l'aura décrite.
- **À la tâche 35** : règle de pare-feu Vercel sur les POST de `/l/*` (forme de `limite-connexion`, groupes ET/OU : gotcha), à régler au tableau de bord ; en formule gratuite la réponse est 403.

## Blocs de relecture
- **PR A** : bloc A1 = tâches 1 à 4 (pur, sans base) ; tâches 5, 6, 7, 8, 9, 10 une par une `[security]` ; bloc A2 = tâches 11 à 16 (écrans) ; tâche 17 avec A2. `/impeccable critique` avant la PR.
- **PR B** : tâches 19 à 25, 27 à 30 une par une `[security]` ; bloc B1 = tâches 26, 31 à 34 ; tâche 35 avec B1.
- **PR C** : tâches 36 à 44 une par une `[security]` ; bloc C1 = tâches 45 à 48 ; tâche 49 avec C1. `/impeccable critique` avant la PR.
- `security-auditor` après le reviewer de chaque `[security]`. Pas d'audit de clôture.

---

# PR A — Base commune et Courses

## Tâches
- [ ] **1. Rayons : clés, ordre par défaut, libellés**
  - Fichiers : `src/modules/shopping/aisles.ts` (11 clés stables + `other`, ordre par défaut de la spec Q1), `messages/fr.json`, `messages/en.json` (`shopping.aisles.<clé>`)
  - Test à écrire d'abord : `src/modules/shopping/aisles.test.ts` — « l'ordre par défaut contient chaque clé une fois, « other » en dernier », « chaque clé a un libellé FR et EN non vide »
  - Fini quand : clés exportées comme tuple typé (`AISLE_KEYS`), `tests/i18n` vert
- [ ] **2. Normalisation d'un libellé**
  - Fichiers : `src/modules/shopping/normalize.ts`
  - Test à écrire d'abord : `normalize.test.ts` — casse, accents, ponctuation, espaces, quantités en tête et en queue (`2 lait`, `lait x2`, `500 g farine`, `1,5 l eau`, `3x yaourts`), pluriels simples (`pommes`, `choux`, `oeufs`), libellé affiché inchangé ; renvoie aussi les formes à essayer (avec et sans `s`/`x` final)
  - Fini quand : fonction pure, sans dépendance, tests verts
- [ ] **3. Dictionnaire FR/EN et jeu de référence**
  - Fichiers : `src/modules/shopping/aisles/dictionary.ts` (mots-clés par rayon, FR et EN, synonymes et abréviations : `deo`, `pq`, `yaourt`/`yogourt`/`yoghourt`, `sopalin`, expressions de plusieurs mots), `src/modules/shopping/aisles/reference-set.ts` (≥ 150 articles courants FR et EN avec rayon attendu, ambiguïtés commentées)
  - Test à écrire d'abord : `dictionary.test.ts` — « aucune clé de dictionnaire n'est en double entre deux rayons sans choix documenté », « toutes les entrées sont déjà normalisées », « chaque entrée du jeu de référence existe à un rayon valide »
  - Fini quand : dictionnaire versionné dans le code, jeu de référence rédigé, tests verts
- [ ] **4. `classifyAisle` : l'unique point d'entrée**
  - Fichiers : `src/modules/shopping/classify.ts` (`classifyAisle(label, { overrides }) → { aisle, source: "override" | "dictionary" | "fallback" }`)
  - Test à écrire d'abord : `classify.test.ts` — « correction mémorisée > dictionnaire > Divers » (un test par ordre), « ≥ 95 % du jeu de référence classé comme attendu », cas d'acceptation (pomme, déo, déodorant, yaourt/yogourt/yoghourt, PQ → Entretien et maison, bidule → Divers), recherche de l'expression la plus longue d'abord ; `classify.architecture.test.ts` — « aucun fichier de `src/` hors `classify.ts` et `mutations.ts` (déplacement manuel) n'écrit `aisle_key` ni n'importe le dictionnaire »
  - Fini quand : fonction pure, `source` renseigné, test d'architecture vert (le branchement futur de l'IA tient dans cette fonction)
- [ ] **5. Migration 0011 : listes, articles, corrections, ordre des rayons** [security]
  - Fichiers : `src/db/schema/shopping.ts`, `src/db/schema/index.ts`, `drizzle/0011_*.sql` (générée par `pnpm db:generate`), GRANT par colonne, `tests/factories/shopping.ts`
  - Test à écrire d'abord : `tests/db/isolation-shopping.test.ts` (connexion `app_backend`, claims posés à la main) — « l'utilisateur du workspace B ne lit ni n'écrit rien chez A » pour `shopping_lists`, `shopping_items`, `shopping_aisle_overrides`, `shopping_aisle_order` ; « un second utilisateur du même workspace ne lit ni n'écrit les corrections ni l'ordre des rayons du premier » ; « le CHECK refuse une clé de rayon inconnue, un libellé de plus de 80 caractères, un ordre de plus de 12 rayons » ; « `channel_id` et `rev` ont leurs défauts » ; `tests/db/migration-0011.test.ts` — « le CHECK des rayons correspond exactement à `AISLE_KEYS` » (comparer au catalogue, pas au fichier : gotcha CHECK)
  - Fini quand : RLS activée dans la migration, une policy par verbe (policies par utilisateur : membre ET `user_id = app.current_user_id()`), migration rétrocompatible, tests verts **sur la base éphémère de la CI** (non appliquée sur `test`)
- [ ] **6. Lire la liste, ajouter un article** [security]
  - Fichiers : `src/modules/shopping/queries.ts` (`getShoppingList`, articles groupés par rayon, ordre des rayons de l'utilisateur, cochés en bas triés par `checked_at`), `src/modules/shopping/mutations.ts` (`ensureList`, `addItem` : normalise, classe via `classifyAisle` avec les corrections de l'utilisateur, incrémente `rev` dans la transaction, verrou consultatif par liste avant de compter, 300 articles et 80 caractères maximum)
  - Test à écrire d'abord : `queries.test.ts`, `mutations.test.ts`, `isolation.test.ts` (deux workspaces, lecture et écriture croisées refusées) — « ajouter « pomme » la range dans Fruits et légumes », « la 301ᵉ ajout est refusé », « un libellé de 81 caractères est refusé », « `rev` augmente d'un par écriture », « deux ajouts simultanés à 299 articles ne dépassent pas 300 »
  - Fini quand : tests verts ; fonctions prennent `workspaceId` puis la transaction ; aucun `limit(1)` d'appartenance
- [ ] **7. Cocher, décocher, renommer, supprimer, vider les cochés** [security]
  - Fichiers : `src/modules/shopping/mutations.ts`
  - Test à écrire d'abord : `mutations-items.test.ts`, `isolation.test.ts` — « un article coché passe en bas de son rayon, décoché il remonte », « vider supprime les cochés et eux seuls », « renommer reclasse seulement si le rayon n'a pas été choisi à la main (`aisle_pinned`) », « chaque écriture incrémente `rev` », « un article d'un autre workspace ne se coche, renomme ni supprime pas »
  - Fini quand : tests verts, un test par comportement
- [ ] **8. Correction mémorisée et ordre des rayons** [security]
  - Fichiers : `src/modules/shopping/mutations.ts` (`moveItemToAisle` : met `aisle_key` + `aisle_pinned`, enregistre la correction par (workspace, utilisateur, libellé normalisé complet) ; `setAisleOrder` : permutation valide des clés, mémorisée par utilisateur), `src/modules/shopping/queries.ts` (`getAisleOverrides`, `getAisleOrder`)
  - Test à écrire d'abord : `mutations-aisles.test.ts`, `isolation.test.ts` — « un article déplacé revient dans ce rayon à l'ajout suivant du même libellé, pour cet utilisateur seulement (deux utilisateurs) », « un ordre qui n'est pas une permutation des rayons est refusé », « l'ordre de l'un n'est pas lisible ni modifiable par l'autre »
  - Fini quand : tests verts, `classifyAisle` reste le seul décideur (test d'architecture de la tâche 4 vert)
- [ ] **9. Actions du registre `shopping.*`** [security]
  - Fichiers : `src/modules/shopping/actions.ts`, `src/modules/shopping/schemas.ts`, `src/modules/actions/registry.ts`, `messages/{fr,en}.json` (descriptions)
  - Test à écrire d'abord : `src/modules/shopping/actions.test.ts`, extension de `src/modules/actions/registry.test.ts` et `isolation.test.ts` — « chaque action refuse un `ctx` incomplet et des paramètres hors schéma », « le canal `assistant` ne contient que `shopping.listItems`, `shopping.addItem`, `shopping.checkItem` (liste blanche) », « chaque action a une description FR et EN », « isolation entre workspaces par action »
  - Fini quand : actions `listItems` (read), `addItem`, `checkItem`, `uncheckItem`, `renameItem`, `removeItem`, `clearChecked`, `moveItemToAisle`, `setAisleOrder` déclarées, `toToolDefinitions` les expose, tests verts
- [ ] **10. Server Actions web des Courses** [security]
  - Fichiers : `src/app/(app)/lists/shopping/actions.ts` (modèle de `src/app/(app)/tasks/actions.ts` et `web-action.ts`), `src/lib/settle-action.ts` côté client (aucun `catch {}` nu)
  - Test à écrire d'abord : `actions.test.ts` — « refuse sans session et renvoie vers `/login` », « le `workspaceId` vient de la session », « une erreur de validation renvoie un message, pas une exception », `unstable_rethrow` en tête de chaque `catch`
  - Fini quand : une Server Action par écriture d'écran, toutes passent par le registre, tests verts
- [ ] **11. Onglet « Listes », route `/lists`, états de chargement et d'erreur**
  - Fichiers : `src/components/shell/nav-items.ts`, `src/app/(app)/lists/layout.tsx`, `src/app/(app)/lists/page.tsx` (redirige vers `/lists/shopping`), `src/app/(app)/lists/shopping/loading.tsx`, `error.tsx` (`retry()`, pas `reset`), `messages/{fr,en}.json`
  - Test à écrire d'abord : `nav-items.test.ts` — « l'onglet Listes est présent côté Privé et absent côté Pro » ; `loading.test.tsx` (modèle de `dashboard/loading.test.tsx`, givre) ; `error.test.tsx`
  - Fini quand : onglet visible côté Privé seulement, la page `/lists` atteinte côté Pro ne montre aucune donnée d'une autre liste (garde du côté actif comme le kanban : relire comment `side` est lu dans `src/app/(app)/tasks`)
- [ ] **12. Écran Courses : lecture par rayon, cocher d'un tap**
  - Fichiers : `src/app/(app)/lists/shopping/page.tsx`, `src/components/shopping/ShoppingList.tsx`, `AisleSection.tsx`, `ShoppingItemRow.tsx`
  - Test à écrire d'abord : `ShoppingList.test.tsx` — « les rayons vides ne sont pas affichés, dans l'ordre de l'utilisateur », « un tap coche (barré, grisé) et l'article descend en bas du rayon, vérifié avant tout `await` (gotcha `useOptimistic`) », « l'échec rend l'article à son état et affiche « pas enregistré, réessayer » » ; état vide
  - Fini quand : mise à jour optimiste du cochage, zone tactile ≥ 44 px, charte DESIGN.md (verre, texte lisible sur verre), tests verts
- [ ] **13. Champ d'ajout rapide enchaînable**
  - Fichiers : `src/components/shopping/QuickAddField.tsx`
  - Test à écrire d'abord : `QuickAddField.test.tsx` — « Entrée ajoute l'article, vide le champ et garde le focus », « un champ vide est ignoré », « 80 caractères maximum », « le champ n'est ni remonté ni remplacé pendant l'ajout » ; `e2e/listes-courses.spec.ts` (ajout enchaîné de quatre articles)
  - Fini quand : police ≥ 16 px (zoom iOS), focus conservé de façon synchrone dans le geste, **vérifié par Antoine sur un iPhone** (gotchas clavier iOS ; le rapport dit ce qui n'est vu que sur appareil)
- [ ] **14. Ordre des rayons au glisser**
  - Fichiers : `src/components/shopping/AisleSortable.tsx` (seul fichier de l'écran qui importe `@dnd-kit/*`), règle `eslint.config.mjs` (étendre l'exception de `@dnd-kit` à ce fichier), poignée ou appui long (250 ms) comme `SortableBoard`
  - Test à écrire d'abord : `AisleSortable.test.tsx` — « l'ordre change et est enregistré par `setAisleOrder` », « l'échec rend l'ordre d'avant avec message », « aucun aimant de défilement pendant un glisser » (gotcha) ; `e2e/listes-courses.spec.ts` — scénario 3
  - Fini quand : ordre gardé après rechargement, aucun composant d'animation dans une ligne déplaçable (gotcha), tests verts
- [ ] **15. Menu de ligne et « Vider les cochés »**
  - Fichiers : `src/components/shopping/ItemMenu.tsx` (Changer de rayon, Renommer, Supprimer avec « Annuler » 5 s), `src/components/shopping/ClearCheckedButton.tsx` (confirmation), `src/components/shopping/MoveAisleSheet.tsx`
  - Test à écrire d'abord : `ItemMenu.test.tsx`, `ClearCheckedButton.test.tsx` — « le bouton n'existe que s'il y a des cochés », « la confirmation précède la suppression », « Annuler rend l'article dans les 5 s » ; placement des popups simulé (`vi.mock` du `Positioner`, gotcha) ; `e2e/listes-courses.spec.ts` — scénario 2
  - Fini quand : changer de rayon mémorise la correction (scénario 2 vert), suppression sans corbeille, tests verts
- [ ] **16. Tuile Courses du tableau de bord**
  - Fichiers : `src/modules/dashboard/tiles.ts` (la tuile placeholder `shopping` devient « Courses » ; titre dans `messages/{fr,en}.json`), `src/components/bento/ShoppingTile.tsx`, lecture par `src/modules/shopping/queries.ts` (`getShoppingSummary`)
  - Test à écrire d'abord : `ShoppingTile.test.tsx` — « affiche le nombre d'articles à acheter et les premiers », « tuile vide propre », « n'apparaît pas côté Pro » ; `tests/i18n` ; test d'isolation de `getShoppingSummary`
  - Fini quand : un tap ouvre `/lists/shopping`, tuile conforme au catalogue existant, tests verts
- [ ] **17. e2e des Courses, passage iPhone, docs**
  - Fichiers : `e2e/listes-courses.spec.ts` (scénarios 1, 2, 3, 11 pour la partie Courses, 12), `docs/architecture.md` (ligne `src/modules/lists` → trois modules `shopping`, `wishlist`, `bucket`, `categories` ; la table de catégories commune a son propre petit module)
  - Test à écrire d'abord : le fichier e2e lui-même (sélecteurs par rôle ou `data-testid`, `test.use({ locale: "fr-FR" })`)
  - Fini quand : e2e vert (`--workers=1`), suite complète verte avant la PR, `/impeccable critique` passé, essai iPhone d'Antoine fait

---

# PR B — Partage par lien et temps réel

## Reprises des audits de la PR A (à traiter dans la PR B)
- **Plafond de 300 articles** : il n'est qu'applicatif (`addItem`). Toute écriture invitée (`guest.add_item`, tâche 28) doit prendre le même verrou consultatif (`shopping.list:<id en minuscules>` via `hashtextextended(…, 0)`) avant de compter ; idéalement une fonction SQL unique `app.shopping_list_lock_key(uuid)` utilisée par l'app et l'invité, ou un trigger BEFORE INSERT. Test de concurrence app + invité ensemble.
- **`channel_id`** : Révoquer et Régénérer le changent (spec) mais `app_backend` n'a aucun UPDATE sur cette colonne (0011) : soit `GRANT UPDATE (channel_id)` avec valeur posée par la base (`gen_random_uuid()`), soit fonction `SECURITY DEFINER` qui vérifie l'appartenance. Rien pour `app_guest` de plus.
- **Ordre des rayons et `rev`** : `setAisleOrder` ne fait pas avancer `rev` (préférence personnelle). La spec (l.61) dit que `guest.read_list` renvoie l'ordre du propriétaire : décider en PR B soit d'avancer `rev` (sous `lockList`) quand un lien est actif, soit d'assumer le décalage jusqu'à la prochaine écriture.
- **Plafond de corrections (500 par utilisateur, applicatif)** : au plafond, l'article change de rayon (épinglé) sans mémoriser de correction ; aucune policy DELETE sur `shopping_aisle_overrides` (0011), donc pas de ménage possible : à reprendre si l'usage s'en approche.
- **Limite de débit** : cocher un article déjà coché fait avancer `rev` ; prévoir une limite de débit sur les Server Actions et fonctions invité de la PR B (relectures forcées via Ably).
- **Injection par libellé (assistant, avant tout branchement du canal)** : `shopping.listItems` renvoie des libellés que l'invité (PR B), puis l'aperçu d'une page externe (PR C) peuvent écrire. Pour la spec de l'assistant : présenter ces textes au modèle comme données délimitées, signaler `addedByGuest`, exiger une confirmation pour toute écriture hors `shopping.*` décidée dans un tour qui a lu `listItems`. À créer en ticket.
- **Canal assistant** : `shopping.addItem` prend `workspaceId` dans `ctx`, jamais dans `params` (tâche 9).

## Tâches
- [ ] **18. Gestes d'Antoine (voir « Gestes d'Antoine »)** — compte Ably et deux applications (production ; previews et local), une `ABLY_API_KEY` par environnement Vercel, `SHARE_TOKEN_KEY` en production, autorisation de `DATABASE_GUEST_URL`
  - Fini quand : Antoine confirme les trois gestes ; aucune valeur n'a été affichée ni écrite dans le dépôt
- [ ] **19. Migration 0012 : table des liens de partage** [security]
  - Fichiers : `src/db/schema/shopping.ts`, `drizzle/0012_*.sql`, GRANT par colonne : `token_hash` jamais lisible par l'application ; `token_ciphertext` lisible par la seule lecture du propriétaire
  - Test à écrire d'abord : `tests/db/isolation-share-links.test.ts` — « le workspace B ne lit ni n'écrit les liens de A », « un second lien actif pour la même liste est refusé (index unique partiel) », « `app_backend` ne peut pas lire `token_hash` », « `token_hash` est unique »
  - Fini quand : RLS et une policy par verbe dans la migration, rétrocompatible, tests verts sur la base éphémère de la CI
- [ ] **20. Migration 0013 : rôle `app_guest`, schéma `guest`, lectures** [security]
  - Fichiers : `drizzle/0013_*.sql` (écrite à la main, `--custom`) : `CREATE ROLE app_guest LOGIN NOBYPASSRLS` sans mot de passe dans le SQL ; `guest.read_list(token_hash)`, `guest.read_overrides(token_hash)` en `SECURITY DEFINER`, `search_path` vide, noms qualifiés, erreur uniforme pour lien inconnu ou révoqué ; `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE` à `app_guest` seulement ; ordre tables → fonctions → policies ; vérifier `proowner` et poser le GRANT explicite (gotchas)
  - Test à écrire d'abord : `tests/db/guest-read.test.ts` (connexion `app_guest`) — « tout SELECT, INSERT, UPDATE, DELETE direct sur une table est refusé », « `read_list` ne renvoie que la liste du lien (deux listes, deux workspaces) », « même erreur pour un jeton inconnu et un jeton révoqué », « aucune fonction ne renvoie `token_ciphertext` »
  - Fini quand : rôle sans aucun droit de table, deux fonctions accordées, tests verts sur la base éphémère
- [ ] **21. Fonctions invité qui écrivent : ajouter et cocher** [security]
  - Fichiers : `drizzle/0013_*.sql` (même migration non appliquée, ou 0013 puis suite si déjà appliquée sur une base de preview : alors une migration 0013b additive) : `guest.add_item(token_hash, label, aisle_key)` (80 caractères, 300 articles, 30 ajouts invités par minute et par lien, `added_by_guest`, incrémente `rev`), `guest.set_checked(token_hash, item_id, checked)` (l'article doit appartenir à la liste du lien)
  - Test à écrire d'abord : `tests/db/guest-write.test.ts` — « l'invité ajoute et coche », « le 31ᵉ ajout en 60 s est refusé », « 81 caractères refusés », « le 301ᵉ article est refusé », « un `item_id` d'une autre liste est refusé », « aucun droit de suppression, renommage ni vidage n'est accordé à `app_guest` (liste exacte des fonctions accordées) », « un jeton révoqué n'écrit plus »
  - Fini quand : tests verts sur la base éphémère ; les workspace_id et list_id viennent du lien, jamais des paramètres
- [ ] **22. CI : mot de passe `app_guest` et `DATABASE_GUEST_URL`** [security]
  - Fichiers : `scripts/ci/neon-branch.mjs` (réinitialise le mot de passe d'`app_guest` sur chaque branche `ci/` et `preview/`, masque les valeurs `::add-mask::`), `scripts/ci/vercel-preview-env.mjs` (pose `DATABASE_GUEST_URL` sur la preview), `scripts/ci/workflows.test.ts`, `.github/workflows/*` si besoin
  - Test à écrire d'abord : tests des scripts existants étendus — « le mot de passe d'`app_guest` est masqué avant d'être écrit », « `DATABASE_GUEST_URL` n'est jamais écrite en clair dans un journal », « aucun secret nouveau en `vars.*` » (verrou de `workflows.test.ts`)
  - Fini quand : **commencer par lire comment `app_backend` reçoit son mot de passe en production et en preview** et reproduire le mécanisme ; si la production exige un geste d'Antoine (mot de passe d'un rôle créé par migration), s'arrêter et le décrire sans afficher de valeur ; tests verts
- [ ] **23. Pool invité et frontière eslint** [security]
  - Fichiers : `src/db/guest-db.ts` (unique accès à `DATABASE_GUEST_URL`, ne sait appeler que les fonctions `guest.*`), `src/env.ts`, `eslint.config.mjs` (`privilegedDbImports` étendue : seuls les fichiers de la page invitée l'importent), `tests/factories/` (helper de test)
  - Test à écrire d'abord : `src/db/guest-db.test.ts` — « l'ouverture sans `DATABASE_GUEST_URL` échoue avec un message sans valeur », « le pool a un écouteur d'erreur permanent (gotcha `createPool`) », test eslint de frontière
  - Fini quand : `createPool` reste le seul point qui crée un pool, aucun import du pool invité hors de la page invitée, tests verts
- [ ] **24. Chiffrement du jeton de partage** [security]
  - Fichiers : `src/modules/shopping/share-token-crypto.ts` (`encryptToken`, `decryptToken`, lecture de `SHARE_TOKEN_KEY`, AES-256-GCM, IV 12 octets aléatoire, tag vérifié, AAD = identifiant du lien, format `v1.<base64url>`), `src/env.ts` (variable optionnelle)
  - Test à écrire d'abord : `share-token-crypto.test.ts` (clé fabriquée en mémoire, `// @vitest-environment node`, gotcha jose) — « deux chiffrements du même jeton diffèrent », « un octet altéré (IV, chiffré, tag) est refusé sans texte partiel », « un chiffré d'un autre lien est refusé (AAD) », « préfixe inconnu refusé », « clé absente, de longueur ≠ 32 octets ou erronée → résultat « indisponible », jamais d'exception brute ni de valeur dans le message »
  - Fini quand : aucune dépendance, aucune valeur de clé ni de jeton dans un message d'erreur, tests verts
- [ ] **25. Mutations du lien : créer, régénérer, révoquer, lire l'état, réafficher** [security]
  - Fichiers : `src/modules/shopping/share.ts` (jeton 32 octets CSPRNG en base64url, sha256 hex, chiffrement si la clé existe, `channel_id` régénéré à chaque régénération et révocation, un seul lien actif), `src/modules/shopping/queries.ts` (`getShareStatus`, `revealShareLink` : seule lecture de `token_ciphertext`)
  - Test à écrire d'abord : `share.test.ts`, `isolation.test.ts` — « ni `token_hash` ni `token_ciphertext` ne contiennent le jeton clair », « régénérer révoque l'ancien et change `channel_id` », « révoquer change `channel_id` », « sans clé, le lien neuf est renvoyé une fois et `token_ciphertext` reste NULL », « un autre workspace ne peut ni lire ni révoquer le lien », « `getShareStatus` n'expose ni jeton ni hachage »
  - Fini quand : tests verts sur la base éphémère
- [ ] **26. QR code local**
  - Fichiers : `package.json`, `pnpm-lock.yaml`, `src/modules/shopping/share-qr.ts` (SVG côté serveur, rendu en URL `data:`)
  - Test à écrire d'abord : `share-qr.test.ts` — « le SVG encode exactement l'URL donnée (relecture de la matrice par la bibliothèque), correction d'erreur au moins M », « aucune requête réseau sortante (requêtes interceptées) » ; `tests/build` — « la bibliothèque n'est pas dans un morceau client »
  - Fini quand : **justification** dans le commit : bibliothèque choisie parmi les candidates à sortie SVG et sans dépendance transitive (à comparer à l'exécution : taille, nombre de dépendances, date de publication > 14 jours, mainteneurs), version épinglée sans `^`, aucun `minimumReleaseAgeExclude` ; essai de scan sur iPhone par Antoine à la tâche 33
- [ ] **27. Actions du registre pour le partage** [security]
  - Fichiers : `src/modules/shopping/actions.ts`, `src/modules/actions/registry.ts`
  - Test à écrire d'abord : `actions-share.test.ts`, `registry.test.ts` — « `createShareLink`, `regenerateShareLink`, `revokeShareLink`, `getShareStatus`, `revealShareLink` sont `web` seulement, **jamais `assistant`**, même `revealShareLink` en lecture (exception testée) », « la liste des actions `assistant` reste exactement celle de la spec », « `revealShareLink` exige session et appartenance », « les actions de l'invité ne sont pas au registre »
  - Fini quand : tests verts, `toToolDefinitions` n'expose aucune action de partage
- [ ] **28. Page invitée `/l/[token]` : route publique, en-têtes, Server Actions invité** [security]
  - Fichiers : `src/lib/auth/routes.ts` (`PUBLIC_ROUTES`), `src/proxy.ts`, `src/lib/security-headers.ts`, `src/app/l/[token]/page.tsx`, `src/app/l/[token]/actions.ts` (lire, ajouter, cocher : classement par `classifyAisle` avec les corrections du propriétaire lues par `guest.read_overrides` côté serveur seulement), `src/app/l/[token]/not-found.tsx`
  - Test à écrire d'abord : `page.test.tsx`, `actions.test.ts`, `tests/security/guest-page-headers.test.ts` — « `noindex` en en-tête et en balise », « `Referrer-Policy: no-referrer` », « `Cache-Control: no-store` », « CSP de la route sans `unsafe-inline` et sans `https:` en `img-src` », « jeton invalide, inconnu ou révoqué : même page, même statut 404 », « aucune ressource externe », « la page ne contient aucune donnée hors de la liste du lien », « aucune action de suppression, renommage ou vidage n'existe »
  - Fini quand : tests verts ; `unstable_rethrow` en tête des `catch` ; langue par `Accept-Language`
- [ ] **29. Jeton absent des journaux et de Sentry** [security]
  - Fichiers : `src/lib/sentry-options.ts` (`beforeSend` : `/l/<jeton>` → `/l/[token]` dans l'URL de requête, le fil d'actions, le nom de transaction, les messages et les tags), vérifier qu'aucun `console.*` ni message d'erreur ne cite le jeton
  - Test à écrire d'abord : `src/lib/sentry-options.test.ts`, `src/lib/sentry-client-envelope.test.ts` étendu — « un événement portant `/l/<jeton>` à ces quatre endroits ressort nettoyé », « un message d'erreur de la page invitée ne contient pas le jeton »
  - Fini quand : tests verts ; la limite des journaux d'exécution de Vercel est écrite dans `docs/runbooks/` (au `/handoff`), Q13 rappelée
- [ ] **30. Ably : publication serveur et jetons d'abonnement** [security]
  - Fichiers : `package.json` (`ably`, version épinglée, > 14 jours, justification de taille et de chargement différé dans le commit), `src/modules/shopping/realtime.ts` (`publishRev(channelId, rev)`, message `{ rev }` seul), `src/app/(app)/lists/shopping/realtime-token.ts` et `src/app/l/[token]/realtime-token.ts` (jeton `subscribe` seul, un seul canal, 10 minutes, propriétaire sur session valide, invité sur lien valide non révoqué), `src/env.ts` (`ABLY_API_KEY` optionnelle : sans elle, publication ignorée sans erreur et rattrapage seul), `src/modules/shopping/channel-name.ts` (`channelName(channelId)` : canal préfixé par environnement, `prod:` en production, `preview:` sur les previews, `dev:` en local, préfixe dérivé côté serveur de `VERCEL_ENV` — jamais du client, jamais d'un paramètre ; le client reçoit le nom complet avec le jeton)
  - Canaux préfixés (décision d'Antoine, 2026-11-28) : publication et jeton d'abonnement passent tous deux par `channelName` ; le jeton ne couvre que le canal préfixé de l'environnement qui l'émet
  - Test à écrire d'abord : `realtime.test.ts` — « le préfixe vient de `VERCEL_ENV` (production → `prod:`, preview → `preview:`, absent → `dev:`) et d'aucune entrée client », « un jeton émis sur une preview ne peut pas s'abonner à un canal `prod:` », « la publication se fait sur le canal préfixé », « le message ne contient que `rev` », « l'échec de publication ne fait pas échouer l'écriture », « le jeton d'invité n'a que `subscribe` sur le canal de sa liste, 10 minutes », « un lien révoqué n'obtient pas de jeton », « un jeton d'un autre canal est refusé » (client Ably factice ; aucune clé réelle dans les tests)
  - Fini quand : publication branchée aux écritures de l'app (tâches 6, 7, 8) et de l'invité (tâche 28), tests verts
- [ ] **31. Client temps réel et rattrapage**
  - Fichiers : `src/components/shopping/useShoppingSync.ts` (chargement différé du SDK, compare `rev`, relit la liste), `src/components/shopping/ShoppingSyncProvider.tsx`
  - Test à écrire d'abord : `useShoppingSync.test.tsx` — « un `rev` plus récent déclenche la relecture », « un `rev` ancien est ignoré », « relecture à la reconnexion du canal, au retour au premier plan (`visibilitychange`) et au retour du réseau (`online`) », « le jeton est renouvelé avant son expiration », « la modification du porteur de l'écran reste optimiste » ; `tests/build/initial-bundle.test.ts` — « le SDK n'est pas dans le bundle initial » (suivre l'indirection `.A(<id>)`, gotcha)
  - Fini quand : tests verts, aucun état reconstruit à partir des seuls messages
- [ ] **32. CSP `connect-src` Ably par route** (les origines Ably sont les mêmes pour tous les canaux ; le préfixe d'environnement ne change rien à la CSP, à vérifier par le test)
  - Fichiers : `src/lib/security-headers.ts`, `src/proxy.ts`
  - Test à écrire d'abord : `tests/security/csp-routes.test.ts` — « `connect-src` ouvre les origines Ably (HTTPS et WebSocket) seulement sur `/lists/shopping` et `/l/[token]`, nulle part ailleurs », « le nonce reste en place », « aucune autre directive ne change »
  - Fini quand : tests verts, vérifié sur `next start`
- [ ] **33. Feuille « Partager » : lien, QR, partage natif, régénérer, révoquer**
  - Fichiers : `src/components/shopping/ShareSheet.tsx`, `src/app/(app)/lists/shopping/share-actions.ts` (Server Actions `[security]`), `messages/{fr,en}.json`
  - Test à écrire d'abord : `ShareSheet.test.tsx` — « le lien, le QR et Copier s'affichent à la création et à la réouverture », « le partage natif n'est proposé que si `navigator.share` existe », « clé absente : « Lien actif — régénérer pour l'afficher ici » sans erreur », « régénérer et révoquer demandent confirmation », « le jeton n'est écrit dans aucun attribut ni journal »
  - Fini quand : tests verts ; **essai de scan du QR par Antoine sur iPhone**
- [ ] **34. Page invitée : écran, pastille « invité », synchro des deux côtés**
  - Fichiers : `src/components/shopping/GuestList.tsx`, `src/components/shopping/GuestBadge.tsx` (pastille sur les articles `added_by_guest` côté propriétaire), `src/app/l/[token]/page.tsx`
  - Test à écrire d'abord : `GuestList.test.tsx` — « l'invité ajoute et coche, sans aucune option de suppression, renommage ni vidage », « un ajout d'Antoine apparaît chez l'invité sans recharger », « « article retiré » sans erreur bloquante si l'article a disparu », « saisie limitée à 80 caractères » ; `GuestBadge.test.tsx`
  - Fini quand : page conforme à la charte, mobile d'abord, aucune ressource externe, tests verts
- [ ] **35. Pare-feu, e2e du partage, QA**
  - Fichiers : `e2e/listes-partage.spec.ts` (scénarios 4, 5, 6, 7 ; deux contextes de navigateur), geste d'Antoine : règle de pare-feu `/l/*`
  - Test à écrire d'abord : le fichier e2e lui-même ; clé Ably de test hors CI (le test de synchro instantanée est joué sur preview ou en local avec la clé d'Antoine, jamais en CI)
  - Fini quand : e2e vert, la règle de pare-feu testée (12 GET passent, le 11ᵉ POST refusé en 403, gotcha), suite complète verte avant la PR, `/qa listes` sur les scénarios 4 à 7

---

# PR C — Wishlist et Bucket List

## Tâches
- [ ] **36. Migration 0014 : catégories, souhaits, bucket** [security]
  - Fichiers : `src/db/schema/lists.ts`, `drizzle/0014_*.sql`, `tests/factories/lists.ts`
  - Test à écrire d'abord : `tests/db/isolation-lists.test.ts` — « le workspace B ne lit ni n'écrit rien chez A » pour `list_categories`, `wishlist_items`, `bucket_items` ; « `price_cents` négatif refusé », « priorité hors liste refusée », « `kind` hors `wishlist|bucket` refusé », « une catégorie de base est unique par (workspace, kind, clé) » ; `tests/db/migration-0014.test.ts` (CHECK comparés au catalogue)
  - Fini quand : RLS dans la migration, une policy par verbe, rétrocompatible, tests verts sur la base éphémère
- [ ] **37. Module des catégories** [security]
  - Fichiers : `src/modules/categories/queries.ts`, `mutations.ts` (`ensureBaseCategories` idempotent par workspace et par `kind`, `saveCategory`, `removeCategory` : les éléments passent en « Autre », « Autre » indestructible), `src/modules/categories/base.ts` (jeux de base de la spec Q5, clés stables), libellés FR/EN dans `messages/`
  - Test à écrire d'abord : `queries.test.ts`, `mutations.test.ts`, `isolation.test.ts` — « les catégories de base apparaissent une fois même après deux appels », « une catégorie non renommée suit la langue, renommée elle est figée », « supprimer une catégorie reclasse ses souhaits en « Autre » », « « Autre » ne se supprime pas », « isolation entre workspaces »
  - Fini quand : tests verts
- [ ] **38. Module Bucket List** [security]
  - Fichiers : `src/modules/bucket/queries.ts`, `mutations.ts` (ajouter, modifier, cocher, supprimer ; tri : non faits par date croissante, sans date en dernier ; faits à part), `schemas.ts`
  - Test à écrire d'abord : `queries.test.ts`, `mutations.test.ts`, `isolation.test.ts` — « tri des non faits », « cocher range dans les faits », « catégorie d'un autre workspace refusée », « 120 caractères maximum »
  - Fini quand : tests verts
- [ ] **39. Module Wishlist (sans aperçu de lien)** [security]
  - Fichiers : `src/modules/wishlist/queries.ts`, `mutations.ts`, `schemas.ts` (lien https ≤ 2048, prix en euros saisi converti en `price_cents` entier sans flottant, priorité, catégorie)
  - Test à écrire d'abord : `queries.test.ts`, `mutations.test.ts`, `isolation.test.ts` — « « 19,90 » devient 1990 centimes, « 19.9 » aussi, « 1e3 » est refusé », « un lien `http://` est refusé à l'enregistrement », « acheté déplace dans la section repliée », « isolation »
  - Fini quand : tests verts, aucun flottant monétaire
- [ ] **40. Garde d'adresses réseau (SSRF)** [security]
  - Fichiers : `src/modules/wishlist/ip-guard.ts` (fonction pure : refuse privées, bouclage, lien-local, CGNAT `100.64.0.0/10`, multicast, réservées, IPv4 mappée en IPv6, adresses de métadonnées `169.254.169.254` et `fd00:ec2::254`)
  - Test à écrire d'abord : `ip-guard.test.ts` — un test par plage de la spec (`127.0.0.1`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.169.254`, `100.64.x`, `[::1]`, `fc00::/7`, `fe80::/10`, `::ffff:10.0.0.1`, `0.0.0.0`) et des adresses publiques acceptées ; formes d'écriture trompeuses (octal, hexadécimal, entier unique) refusées avant résolution
  - Fini quand : fonction pure, tests verts
- [ ] **41. Récupération de l'aperçu d'un lien** [security]
  - Fichiers : `src/modules/wishlist/link-preview.ts` (`https` et port 443 seulement, pas d'identifiants dans l'URL ; résolution DNS de toutes les adresses (A et AAAA) puis refus si l'une est interdite ; **connexion à l'adresse vérifiée** avec SNI du nom d'hôte, sans seconde résolution ; redirections à la main, 3 au plus, chaque saut revérifié ; délai total 4 s ; lecture limitée à 512 Kio ; `Content-Type` `text/html` seulement ; aucun cookie ni en-tête de l'utilisateur ; `og:image`/`twitter:image` et `og:title` lus dans les balises `<meta>` du début de la page ; URL d'image revérifiée https ≤ 2048 ; titre nettoyé et tronqué ; erreurs génériques), module Node seulement (pas de runtime edge)
  - Test à écrire d'abord : `link-preview.test.ts` (serveur HTTPS local factice et résolveur factice, aucune requête réelle) — un test par refus de la spec : `http://`, port ≠ 443, `https://user:pass@…`, `localhost`, nom qui résout vers une adresse privée, nom à deux adresses dont une privée, redirection vers une adresse privée, 4 redirections, réponse de plus de 512 Kio, délai de plus de 4 s, contenu non HTML ; « la connexion part vers l'adresse vérifiée, pas vers une seconde résolution (DNS qui change entre deux appels) » ; « un lien public renvoie titre et image » ; aucun message d'erreur ne cite l'adresse ni le réseau
  - Fini quand : tests verts ; aucune nouvelle dépendance ; `// @vitest-environment node`
- [ ] **42. Server Action d'aperçu et intégration à l'ajout** [security]
  - Fichiers : `src/app/(app)/lists/wishlist/actions.ts` (`previewLink`, `addWishlistItem`, `updateWishlistItem`, `markPurchased`, `removeWishlistItem`), `src/modules/wishlist/mutations.ts`
  - Test à écrire d'abord : `actions.test.ts` — « l'échec de l'aperçu crée le souhait sans image et sans erreur bloquante », « le titre n'est pré-rempli que si le champ est vide », « refuse sans session », « l'URL d'image stockée est une URL https revérifiée »
  - Fini quand : tests verts, `unstable_rethrow` en tête des `catch`, `settleAction` côté client
- [ ] **43. Actions du registre : souhaits, bucket, catégories** [security]
  - Fichiers : `src/modules/wishlist/actions.ts`, `src/modules/bucket/actions.ts`, `src/modules/categories/actions.ts`, `src/modules/actions/registry.ts`, descriptions FR/EN
  - Test à écrire d'abord : `actions.test.ts` de chaque module, `registry.test.ts` — « le canal `assistant` ajoute exactement `wishlist.addItem`, `bucket.addItem` et les lectures de la spec », « `previewLink` n'est pas au registre (appel réseau sortant) », « chaque action refuse un `ctx` incomplet », « isolation »
  - Fini quand : noms de la spec déclarés, tests verts
- [ ] **44. CSP `img-src https:` sur `/lists/wishlist` seulement** [security]
  - Fichiers : `src/lib/security-headers.ts`, `src/proxy.ts`
  - Test à écrire d'abord : `tests/security/csp-routes.test.ts` (étendu) — « `https:` figure dans `img-src` de `/lists/wishlist` et de ses sous-chemins, et nulle part ailleurs : `/l/[token]`, `/lists/shopping`, `/lists/bucket`, `/dashboard`, `/login`, `/settings` », « les autres directives de `/lists/wishlist` sont inchangées »
  - Fini quand : tests verts ; vérifié sur `next start` avec une vraie image distante
- [ ] **45. Écran Wishlist**
  - Fichiers : `src/app/(app)/lists/wishlist/page.tsx`, `loading.tsx`, `error.tsx`, `src/components/wishlist/WishlistList.tsx`, `WishlistRow.tsx`, `WishlistForm.tsx` (coller un lien → aperçu, titre, prix, priorité, catégorie), `WishlistImage.tsx` (`referrerpolicy="no-referrer"`, chargement différé, repli visuel)
  - Test à écrire d'abord : `WishlistForm.test.tsx`, `WishlistImage.test.tsx` — « le lien collé lance l'aperçu et pré-remplit le titre vide », « l'échec laisse le formulaire utilisable », « l'image en erreur affiche le repli », « acheté déplace dans la section repliée », « prix saisi en euros affiché en euros » ; `e2e/listes-envies.spec.ts` (scénario 8)
  - Fini quand : mobile d'abord, charte DESIGN.md, tests verts
- [ ] **46. Gestion des catégories**
  - Fichiers : `src/components/lists/CategoryManager.tsx` (créer, renommer, supprimer ; partagé Wishlist et Bucket par le paramètre `kind`), actions web des catégories
  - Test à écrire d'abord : `CategoryManager.test.tsx` — « créer, renommer, supprimer reclasse en Autre », « « Autre » sans bouton de suppression », « libellés de base traduits tant qu'ils ne sont pas renommés » ; `e2e/listes-envies.spec.ts` (scénario 9)
  - Fini quand : tests verts
- [ ] **47. Écran Bucket List**
  - Fichiers : `src/app/(app)/lists/bucket/page.tsx`, `loading.tsx`, `error.tsx`, `src/components/bucket/BucketList.tsx`, `BucketForm.tsx`
  - Test à écrire d'abord : `BucketList.test.tsx` — « un tap coche et range dans « Faits » », « tri par date, sans date en dernier », « date passée acceptée » ; `e2e/listes-envies.spec.ts` (scénario 10)
  - Fini quand : tests verts, mobile d'abord
- [ ] **48. Contrôle segmenté complet, tuile Wishlist, i18n**
  - Fichiers : `src/app/(app)/lists/layout.tsx` (Courses · Wishlist · Bucket List), `src/modules/dashboard/tiles.ts`, `src/components/bento/WishlistTile.tsx`, `messages/{fr,en}.json`
  - Test à écrire d'abord : `layout.test.tsx` — « les trois segments mènent aux trois routes », `WishlistTile.test.tsx` — « nombre de souhaits non achetés, tuile vide propre », `tests/i18n` complet
  - Fini quand : navigation complète, aucun texte en dur, tests verts
- [ ] **49. e2e des envies, QA, docs**
  - Fichiers : `e2e/listes-envies.spec.ts` (scénarios 8 à 11, 12 côté Wishlist et Bucket), `docs/architecture.md`
  - Test à écrire d'abord : le fichier e2e lui-même (le scénario `http://localhost:3000` prouve l'absence d'erreur bloquante)
  - Fini quand : e2e vert, suite complète verte avant la PR, `/impeccable critique` passé, `/qa listes` sur les scénarios 8 à 11

## Corrections QA
<!-- Alimenté par /qa. Même format que les tâches. -->

## Tickets à créer (hors de cette feature)
- Courses hors ligne : BRAIN-74 (déjà créé).
- Rotation de `SHARE_TOKEN_KEY` avec outil de re-chiffrement (le format `v1.` le permet).
- Jeton dans le fragment d'URL si l'usage s'étend à des tiers moins proches (spec Q13).
- Rayons personnalisés, ordre manuel des articles dans un rayon, quantité structurée.
- Le jour où Neon Realtime gère la RLS (ADR-011) : réévaluer le transport.

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
