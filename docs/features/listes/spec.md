# Spec — Listes : Courses, Wishlist, Bucket List (BRAIN-9, BRAIN-10)

**Créée le** : 2026-11-28 · **Statut** : validée par Antoine le 2026-11-28 (Q1 à Q12 validées, précisions sur Q7 et Q8, lien de partage permanent et réaffichable) · **Plan** : `plan.md` · **ADR liés** : ADR-011 (temps réel), ADR-002 (corrigé), 004, 007, 008, 009, 010

Les décisions d'Antoine des commentaires Linear du 2026-11-27 priment sur les descriptions des tickets ; elles sont reprises telles quelles ci-dessous. Les questions validées sont en fin de document.

## Objectif
Antoine tient ses courses, ses envies d'achat et ses envies de vie dans BeMyBrain, au téléphone d'abord : une liste de courses rangée par rayon qu'on coche d'un tap et qu'une autre personne complète par un simple lien, avec mise à jour instantanée des deux côtés ; une wishlist enrichie par l'image du lien collé ; une bucket list à cocher.

## Hors périmètre
- Espace **Pro** : les trois listes n'existent que côté Privé.
- Plusieurs listes de courses, partage d'une autre liste que Courses, partage de la wishlist ou de la bucket list.
- Champ quantité structuré, unités, fusion de doublons, historique d'achats, prix des courses (§ Questions, Q2).
- Mode hors ligne (service worker) : la feuille de route le rattache aux courses, mais il double le chantier et croise la synchro instantanée → suivi dans [BRAIN-74](https://linear.app/nexxia-studio/issue/BRAIN-74) (§ Questions, Q8).
- IA de classement (BRAIN-38) : seul le point d'entrée est prévu.
- Rayons personnalisés (créer, renommer, supprimer un rayon) : la liste de rayons est fixe, seul leur ordre se règle.
- Ordre manuel des articles dans un rayon (ordre d'ajout, cochés en bas).
- Corbeille des articles de courses : suppression définitive.
- Invité nommé, plusieurs invités distincts, droits différents par lien : un lien actif au plus, tous les porteurs du lien ont les mêmes droits.
- Fichiers d'images stockés : on garde l'URL de l'image, rien d'autre.
- QR code par un service externe, aperçu du lien par un tiers : le QR est généré localement.
- Rotation automatique de `SHARE_TOKEN_KEY` : le format versionné la permet, l'outil de rotation n'est pas construit.
- Prix automatique, suivi de baisse de prix, devises autres que l'euro.
- Partage du workspace entre membres (BRAIN-32) : les listes sont rattachées au workspace Privé d'un seul membre ; avec un espace partagé, elles ne doivent pas y apparaître (à traiter par BRAIN-32).
- Espaces du Privé (BRAIN-30) : les trois listes ignorent le filtre d'espace (§ Questions, Q4).

## Découpage en trois PR (validé, Q10)
- **PR A — Base commune + Courses sans partage** : module `shopping`, classement, rayons ordonnables, cochés, « Vider les cochés », registre, navigation « Listes », tuile Courses, FR/EN. Aucune route publique.
- **PR B — Partage par lien + temps réel** : rôle `app_guest` et ses fonctions, liens, page invitée, canal Ably, CSP, pare-feu. Se débloque par une action d'Antoine (compte Ably, clé).
- **PR C — Wishlist + Bucket List** : modules `wishlist` et `bucket`, catégories, récupération d'image côté serveur (SSRF), CSP des images, segments de navigation, tuile.
Ordre A → B → C. Si le compte Ably n'est pas prêt, B et C se permutent sans rien changer à A.

## Règles métier

### Courses
- Une seule liste « Courses » par workspace, créée au premier accès (au premier ajout ou à la première ouverture de la page).
- **Ajout rapide** : un champ en bas d'écran ; Entrée ajoute l'article, vide le champ et **garde le focus** (le clavier iPhone reste ouvert) pour enchaîner. Libellé : 1 à 80 caractères après trim, espaces internes réduits. Vide : ignoré.
- **Champ collant** (décision d'Antoine du 2026-11-28) : le champ reste collé en bas, au-dessus de la barre d'onglets et du clavier iOS, avec le libellé visible « Ajouter un article » / « Add an item » et le placeholder « Lait, pain… » / « Milk, bread… ». Critère d'acceptation : à 390×844, liste vide ou courte, le bas du champ touche la réserve de la barre d'onglets ; la bulle « Article supprimé » ne le recouvre jamais, erreur affichée comprise.
- **Classement automatique** par rayon à l'ajout (§ Classement). L'article apparaît tout de suite dans son rayon.
- **Rayons** (fixes, Q1) : 11 rayons + « Divers ». Chaque rayon a une clé stable en code (`produce`, `bakery`, …) et un libellé par langue. Un rayon sans article n'est pas affiché.
- **Ordre des rayons** : l'utilisateur les glisse (appui long puis glisser, même comportement et même bibliothèque que le tableau kanban, `@dnd-kit` déjà installé) ; l'ordre est mémorisé **par utilisateur**. Par défaut : ordre de la liste de Q1. « Divers » reste réordonnable comme les autres.
- **Cocher** : un tap sur la ligne coche (barré, grisé) et l'article descend en bas de son rayon (cochés triés par date de cochage). Redécocher le remonte à sa place d'ajout.
- **Vider les cochés** : bouton visible seulement s'il existe des cochés, avec confirmation ; supprime définitivement tous les cochés de la liste. Réservé au propriétaire.
- **Changer un article de rayon** : menu de la ligne « Changer de rayon » (pas de glisser d'article entre rayons : trop fragile au doigt sur une liste dense). Effet : l'article change de rayon **et** la correction est mémorisée.
- **Supprimer** un article : propriétaire seulement, depuis le menu de la ligne, définitif.
- **Renommer** : propriétaire seulement (champ éditable d'un tap long ou depuis le menu) ; reclasse l'article seulement si l'ancien rayon n'avait pas été choisi à la main (sinon il garde son rayon).
- **Marqueur invité** : un article ajouté par un invité porte une pastille discrète « invité » pour le propriétaire (Q9).

### Classement : un seul point d'entrée
Fonction unique `classifyAisle(label, context)` dans `src/modules/shopping/classify.ts`, qui rend `{ aisle, source }` avec `source ∈ { override, dictionary, fallback }`. Aucun autre code ne décide d'un rayon. Ordre de décision (non négociable) : **correction mémorisée > dictionnaire > Divers**. Le futur appel IA (BRAIN-38) viendra se loger entre le dictionnaire et « Divers » dans cette fonction, pour les seuls cas `fallback`, sans changer ses appelants (`source` permet de repérer ces cas).
Normalisation, identique pour la correction et le dictionnaire :
1. minuscules, accents retirés (NFD), apostrophes et ponctuation → espace, espaces réduits ;
2. quantité retirée en tête ou en queue (`2 lait`, `lait x2`, `500 g farine`, `1,5 l eau`, `3x yaourts`) : nombre, `x`, unités usuelles (`g kg l cl ml pce pcs boite paquet`) ; le libellé affiché reste tel que saisi ;
3. pluriels simples : on essaie le mot tel quel puis sans `s`/`x` final (`pommes`, `yaourts`, `choux`, `oeufs`) ;
4. recherche : d'abord l'expression entière, puis les expressions de plusieurs mots (`papier toilette`, `creme fraiche`) du plus long au plus court, puis les mots seuls ; le premier rayon trouvé gagne ; à longueur égale, ordre de déclaration du dictionnaire.
Dictionnaire : `src/modules/shopping/aisles/dictionary.ts`, FR et EN, avec synonymes et abréviations (`deo`, `pq`, `yaourt`/`yogourt`/`yoghourt`, `sopalin`…), versionné dans le code, testé contre un jeu de référence (§ Critères). Une correction mémorisée est clé = libellé normalisé complet (après quantité), par (workspace, utilisateur).

### Partage sans compte (BRAIN-9, `[security]`)
**Mécanisme exact par lequel l'invité n'atteint que cette liste.** Les tables gardent leurs policies RLS réservées aux membres du workspace : **aucune policy n'est ouverte à l'invité, aucune table ne lui est accordée.**
1. Un rôle Postgres dédié `app_guest` (`LOGIN NOBYPASSRLS`, créé en SQL, jamais par la console Neon : gotcha `neon_superuser`) n'a **aucun droit sur aucune table**. Il a `EXECUTE` sur quatre fonctions du schéma `guest` seulement.
2. Ces fonctions sont `SECURITY DEFINER`, `search_path` vide, noms de tables qualifiés, et reçoivent le **hachage** du jeton (sha256 en hex calculé côté serveur, le jeton clair ne va jamais en base) :
   - `guest.read_list(token_hash)` : articles de la liste du lien, ordre des rayons du propriétaire, `rev`, `channel_id`. Rien d'autre. **Aucune fonction `guest.*` ne lit ni ne renvoie `token_ciphertext`** (le jeton chiffré n'est lisible que par l'action propriétaire, ci-dessous).
   - `guest.add_item(token_hash, label, aisle_key)` : ajoute un article (`added_by_guest = true`), refuse au-delà de 80 caractères, de 300 articles dans la liste ou de 30 ajouts invités en 60 s pour ce lien.
   - `guest.set_checked(token_hash, item_id, checked)` : coche ou décoche **un article de cette liste** (l'`item_id` doit appartenir à la liste du lien).
   - `guest.read_overrides(token_hash)` : corrections mémorisées du propriétaire du lien, lues par le serveur pour classer l'article de l'invité, jamais renvoyées au navigateur.
   Chaque fonction commence par la même résolution : lien trouvé par hachage, `revoked_at IS NULL`, sinon erreur uniforme (« lien invalide », identique pour inconnu et révoqué, pas d'oracle). `workspace_id` et `list_id` viennent du lien, jamais des paramètres.
3. Il n'existe **aucune** fonction invité pour supprimer, renommer, vider, régénérer, lire une autre liste, ni lire quoi que ce soit hors de cette liste. Ce que l'invité ne peut pas faire n'est pas filtré : c'est inexistant.
4. Les fonctions `guest.*` sont créées après les tables (ordre des migrations, gotcha), avec `REVOKE ALL ... FROM PUBLIC` puis `GRANT EXECUTE` explicite à `app_guest` (gotcha `proowner`/REVOKE par défaut global de 0005).
5. Accès base de l'invité : second pool avec `DATABASE_GUEST_URL`, isolé dans un fichier unique de `src/db/` (règle eslint `privilegedDbImports` étendue) et utilisable par les seules Server Actions de la page invitée. Le rôle propriétaire n'est jamais utilisé pour répondre à une requête (ADR-002, `.claude/rules/neon.md`).
6. Le mot de passe de `app_guest` est posé et réinitialisé par la CI comme celui d'`app_backend` (`scripts/ci/neon-branch.mjs`, branches `ci/` et `preview/`) et rangé dans 1Password ; `DATABASE_GUEST_URL` va dans les variables Vercel production et previews (ADR-010). Un compromis du mot de passe donne au plus : lire/ajouter/cocher sur une liste dont on connaît déjà le hachage valide du jeton, c'est-à-dire rien.

**Lien (permanent et réaffichable, décision d'Antoine du 2026-11-28)** : jeton de 32 octets aléatoires (CSPRNG), encodé en base64url (43 caractères), `/l/<jeton>`. Un seul lien actif par liste (index unique partiel sur `list_id WHERE revoked_at IS NULL`). Il reste valable jusqu'à révocation ou régénération (pas d'expiration, Q6) et peut être **réaffiché à tout moment** dans la feuille « Partager », avec un **QR code** et le **partage natif** du téléphone (`navigator.share`) en plus de Copier.
- En base : `token_hash` (sha256 hex, unique : sert à la recherche et à la vérification par les fonctions `guest.*`, inchangé) et `token_ciphertext` (le jeton chiffré, pour le réafficher), plus `created_by_user_id`, `created_at`, `revoked_at`.
- Chiffrement : AES-256-GCM (`node:crypto`, aucune dépendance), IV de 12 octets **aléatoire à chaque chiffrement**, tag de 16 octets **vérifié** au déchiffrement (toute altération → refus, jamais de texte partiel), identifiant du lien lié comme donnée authentifiée (AAD) : un chiffré copié d'une ligne à l'autre est refusé. Format texte versionné `v1.<base64url(iv ‖ chiffré ‖ tag)>` pour permettre une rotation de clé plus tard.
- Clé `SHARE_TOKEN_KEY` : 32 octets en base64 (44 caractères), **uniquement dans les variables Vercel de production** (sensible, environnement Production seul) et dans 1Password ; **absente des previews et de la CI** ; en local, une clé jetable propre au `.env` de la base `dev`, jamais celle de production. Les tests fabriquent leur clé en mémoire (aucune clé réelle dans la CI). Clé absente, mal formée (longueur ≠ 32 octets) ou qui ne déchiffre pas : la feuille affiche « Lien actif — régénérer pour l'afficher ici », sans erreur ni plantage, et la création d'un lien affiche le lien neuf une fois même sans clé (`token_ciphertext` reste alors NULL).
- Lecture du jeton : **une seule action propriétaire**, `shopping.revealShareLink`, canal `web` seul (jamais `assistant`), session et appartenance vérifiées, qui déchiffre côté serveur et renvoie `{ url, qr }`. Les fonctions `guest.*` ne voient jamais le chiffré ; `app_guest` n'a aucun droit sur la table.
- QR code : généré **localement côté serveur** par une bibliothèque épinglée (version de plus de 14 jours, justifiée au plan : taille, absence de dépendances, sortie SVG), rendu en SVG renvoyé comme URL `data:` (déjà admise par `img-src`) ; aucun service externe, aucune requête sortante.
- Confidentialité du jeton : jamais écrit dans un journal ni dans Sentry. L'URL `/l/<jeton>` est nettoyée en `/l/[token]` dans tout événement, fil d'actions et nom de transaction Sentry (`beforeSend` de `src/lib/sentry-options.ts`), aucun `console.*` ne l'affiche, les messages d'erreur ne le citent pas. Limite assumée : les journaux d'exécution de Vercel enregistrent le chemin demandé, donc le jeton ; accès réservé à Antoine (Q13).
- **Régénérer** : révoque l'ancien lien (`revoked_at`), crée le nouveau, change le `channel_id` ; **Révoquer** : révoque et change le `channel_id`. L'ancien lien cesse de fonctionner immédiatement (ADR-011).
**Page invitée** `/l/[token]` : route publique (ajoutée à `PUBLIC_ROUTES` de `src/lib/auth/routes.ts`), rendu serveur, sans aucune ressource externe (pas d'image, pas de lien sortant, pas de police tierce), `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` et `<meta name="robots">`, `Cache-Control: no-store`, **CSP actuelle inchangée** (pas d'assouplissement `img-src`, Q7). Langue : `Accept-Language` (FR/EN). Jeton invalide ou révoqué : page neutre « Ce lien n'est plus valide », statut 404, sans distinction. Saisies : 80 caractères max, 1 ligne. Cadence : plafonds en base (ci-dessus) + règle de pare-feu Vercel sur les POST de `/l/*` (même forme que `limite-connexion`, gotcha des groupes ET/OU), réglée par Antoine au tableau de bord.
**Ce que voit l'invité** : le nom « Courses », les articles regroupés par rayon dans l'ordre du propriétaire, cochés compris. Rien d'autre : ni nom, ni e-mail, ni espaces, ni autres données.

### Synchro instantanée (ADR-011)
- Après toute écriture de la liste (app ou invité), le serveur publie `{ rev }` sur `shopping:<channel_id>`. `rev` est un compteur de la liste, incrémenté dans la transaction de l'écriture.
- À la réception d'un `rev` plus récent que celui affiché, le client relit la liste. Les modifications du porteur de l'écran sont **optimistes** (même technique que le kanban : affichage immédiat, retour animé + message si l'écriture échoue).
- **Rattrapage** (obligatoire) : relecture à l'ouverture, à la reconnexion du canal, au retour au premier plan et au retour du réseau. Une écriture échouée hors ligne n'est pas rejouée en silence : message « pas enregistré, réessayer ».
- Jetons Ably : propriétaire sur session valide, invité sur lien valide ; `subscribe` sur son seul canal ; 10 min, renouvelés tant que l'accès existe.
- Conflits : dernier écrit gagne sur `checked_at` ; un article supprimé pendant qu'un invité le coche renvoie « article retiré » côté invité, sans erreur bloquante.

### Wishlist (PR C)
- Champs : titre (1–120), lien (https, ≤ 2048, optionnel), prix saisi à la main en `price_cents` (entier ≥ 0, optionnel, affiché en euros), priorité `high | medium | someday` (défaut `medium`), catégorie (obligatoire, défaut « Autre »), image (URL https ≤ 2048, optionnelle, jamais saisie à la main), acheté (`purchased_at`).
- **Aperçu de lien** : à la collée d'un lien, une Server Action récupère `og:image`/`twitter:image` et `og:title` de la page. Titre pré-rempli seulement si le champ titre est vide. Échec (n'importe lequel) : le souhait se crée **sans image, sans erreur bloquante**.
- **Protection SSRF** (`[security]`), toutes obligatoires, chacune testée : schéma `https` seulement, port 443 seulement, pas d'identifiants dans l'URL ; résolution DNS de **toutes** les adresses (A et AAAA) puis refus si l'une est privée, de bouclage, lien-local, CGNAT `100.64.0.0/10`, multicast, réservée, IPv4 mappée en IPv6, ou une adresse de métadonnées cloud (`169.254.169.254`, `fd00:ec2::254`) ; **connexion à l'adresse vérifiée** (pas de seconde résolution, contre le DNS rebinding) avec SNI du nom d'hôte ; redirections suivies à la main, 3 au plus, **chaque saut revérifié** de la même façon ; délai total 4 s ; lecture limitée à 512 Kio et abandonnée au-delà ; `Content-Type` `text/html` seulement ; aucun cookie, aucun en-tête de l'utilisateur transmis ; URL d'image revérifiée (https, longueur) avant d'être stockée ; texte du titre nettoyé et tronqué ; messages d'erreur génériques (pas de détail réseau renvoyé).
- **Catégories** : une dizaine de base (Q5) + celles d'Antoine, qui peut en créer, renommer et supprimer (suppression : les souhaits passent en « Autre »).
- **Affichage des images** : l'URL est distante, la CSP actuelle (`img-src 'self' blob: data:`) les bloque. Décision (Q7, validée) : `img-src` reçoit `https:` **sur la seule route `/lists/wishlist`** (CSP par route, posée par `src/proxy.ts` à partir du chemin) ; **toutes les autres routes gardent la CSP actuelle, page invitée et `/lists/shopping` comprises**. Chaque image porte `referrerpolicy="no-referrer"`, chargement différé, repli sur un visuel neutre en cas d'échec. Un test construit la CSP de chaque route connue et vérifie que `https:` figure dans `img-src` de `/lists/wishlist` et nulle part ailleurs (dont `/l/[token]`, `/lists/shopping`, `/lists/bucket`, `/dashboard`, `/login`).
- Acheté : un tap coche, la ligne passe dans une section « Acheté » repliée.

### Bucket List (PR C)
- Champs : intitulé (1–120), catégorie (Q5, jeu de catégories propre à la bucket list), date optionnelle (jour, passée ou future), fait ou non (`done_at`).
- Un tap coche. Tri : non faits d'abord (date croissante, sans date en dernier), faits dans une section repliée.

### Navigation et tableau de bord (Q3, Q4)
- Un onglet « Listes » dans la barre du bas (côté Privé seulement, masqué côté Pro), route `/lists`, qui s'ouvre sur « Courses » ; un contrôle segmenté en tête bascule entre Courses, Wishlist, Bucket List (les deux derniers arrivent en PR C). Sous-routes `/lists/shopping`, `/lists/wishlist`, `/lists/bucket`.
- La tuile placeholder « shopping » du tableau de bord (`src/modules/dashboard/tiles.ts`) devient la tuile **Courses** : nombre d'articles à acheter et les premiers articles ; un tap ouvre `/lists/shopping`. Tuile **Wishlist** en PR C (Q3).
- Charte DESIGN.md et effets de verre existants ; aucune couleur ni police hors DESIGN.md (`/impeccable critique` avant livraison de l'UI, comme le kanban).

### Registre d'actions (ADR-009)
Toutes les actions passent par `defineAction`, avec `access`, `params` zod `strictObject` et `ctx` serveur. Noms (`<module>.<verbe>`) :
- `shopping.listItems` (read) · `shopping.addItem` · `shopping.checkItem` · `shopping.uncheckItem` · `shopping.renameItem` · `shopping.removeItem` · `shopping.clearChecked` · `shopping.moveItemToAisle` · `shopping.setAisleOrder` (write) · `shopping.createShareLink` · `shopping.regenerateShareLink` · `shopping.revokeShareLink` · `shopping.getShareStatus` (read : actif ou non, date, présence du chiffré ; jamais le jeton) · `shopping.revealShareLink` (read : déchiffre et renvoie URL et QR au propriétaire).
- `wishlist.listItems` (read) · `wishlist.addItem` · `wishlist.updateItem` · `wishlist.markPurchased` · `wishlist.removeItem` · `wishlist.listCategories` (read) · `wishlist.saveCategory` · `wishlist.removeCategory`.
- `bucket.listItems` (read) · `bucket.addItem` · `bucket.updateItem` · `bucket.markDone` · `bucket.removeItem` · `bucket.listCategories` (read) · `bucket.saveCategory` · `bucket.removeCategory`.
- Canaux : `web` pour toutes ; `assistant` pour les lectures et pour `shopping.addItem`, `shopping.checkItem`, `wishlist.addItem`, `bucket.addItem` seulement (liste blanche explicite d'écritures, comme ADR-009). `createShareLink`, `regenerateShareLink`, `revokeShareLink`, `getShareStatus` et `revealShareLink` : `web` seul (le jeton ne doit pas transiter par un assistant, même `revealShareLink` bien qu'il soit en lecture : exception explicite à la règle « l'assistant voit les lectures », testée).
- Les actions de l'**invité** ne sont **pas** dans le registre : l'invité n'a pas de session, ses trois écritures sont les Server Actions de la page invitée, reliées aux fonctions `guest.*`.
- Chaque module expose ses lectures dans `queries.ts` (ADR-004).

## Données et RLS
Modules : `src/modules/shopping`, `wishlist`, `bucket` (une migration additive et rétrocompatible par PR ; toute migration est `[security]`). Toutes les tables : `id uuid`, `workspace_id uuid NOT NULL`, FK composites avec `workspace_id`, `created_at`, `updated_at`, **RLS activée dans la migration de création**, une policy par verbe (`app.is_workspace_member(workspace_id)`), GRANT par colonne, index sur chaque FK et sur `(workspace_id, …)`. Enums en `CHECK`. Test d'isolation entre deux workspaces par module.

**PR A — migration 0011** : 
- `shopping_lists` (`workspace_id`, `name`, `rev bigint not null default 0`, `channel_id uuid not null default gen_random_uuid()`) ; unique `(workspace_id)`.
- `shopping_items` (`list_id`, `label` ≤ 80, `aisle_key` CHECK ∈ clés connues, `checked_at`, `added_by_guest boolean not null default false`, `aisle_pinned boolean not null default false`) ; index `(workspace_id, list_id)`.
- `shopping_aisle_overrides` (`user_id`, `keyword` ≤ 80, `aisle_key`) ; unique `(workspace_id, user_id, keyword)` ; policies : membre **et** `user_id = app.current_user_id()`.
- `shopping_aisle_order` (`user_id`, `aisle_keys text[]`, CHECK longueur ≤ 12) ; unique `(workspace_id, user_id)` ; mêmes policies par utilisateur.
**PR B — migrations 0012 (table des liens) et 0013 (rôle et fonctions)** : `shopping_share_links` (`list_id`, `token_hash` unique, `token_ciphertext text` nullable, `created_by_user_id`, `revoked_at`) + index unique partiel (un lien actif par liste), rôle `app_guest`, schéma `guest` et ses quatre fonctions, REVOKE/GRANT. Policies de la table : membres seulement (propriétaire crée/révoque). GRANT par colonne : `token_hash` n'est jamais lisible par l'application (écrit à la création, comparé seulement dans les fonctions `guest.*`) ; `token_ciphertext` n'est lisible que par `shopping.revealShareLink`. Les lectures ordinaires (`getShareStatus`) n'exposent que « actif ou non », la date et « chiffré présent ».
**PR C — migration 0014** : `list_categories` (`kind` CHECK `wishlist|bucket`, `key` nullable pour les catégories de base, `name` nullable : NULL = libellé traduit, renommée = texte figé ; `position`), `wishlist_items` (`title`, `url`, `image_url`, `price_cents integer CHECK >= 0`, `priority` CHECK, `category_id`, `purchased_at`), `bucket_items` (`title`, `category_id`, `due_on date`, `done_at`).
Aucun montant flottant ; `price_cents` entier.

Argent / paiement : prix saisis à titre indicatif, aucun paiement → pas d'audit « paiement ». **Audit `security-auditor` obligatoire** sur chaque tâche `[security]` : toute migration, `app_guest` et ses fonctions, la page invitée, les Server Actions qui écrivent, le jeton Ably, la récupération d'aperçu (SSRF).

## Critères d'acceptation
Courses
- [ ] Ajouter « pomme » la range dans Fruits et légumes ; « déo » et « déodorant » dans Hygiène et soins ; « yaourt », « yogourt » et « yoghourt » dans Crèmerie ; « PQ » dans Entretien et maison (Q1) ; « bidule » dans Divers.
- [ ] Jeu de référence d'au moins 150 articles FR et EN courants : au moins 95 % dans le rayon attendu ; les articles ambigus du jeu documentent leur choix ; tests de normalisation (casse, accents, pluriels, quantités `2 lait`, `lait x2`, `500 g farine`).
- [ ] Un article déplacé à la main vers un autre rayon y revient à tous les ajouts suivants du même libellé, pour cet utilisateur seulement (test avec deux utilisateurs).
- [ ] Ordre de décision : une correction mémorisée l'emporte sur le dictionnaire, qui l'emporte sur Divers (test unitaire direct de `classifyAisle`, qui est le seul chemin de classement : un test d'architecture vérifie qu'aucune autre fonction n'écrit `aisle_key` sans passer par lui, hors déplacement manuel).
- [ ] Entrée ajoute l'article, vide le champ et conserve le focus ; vérifié sur iPhone (les tests automatiques ne voient pas le clavier : gotcha clavier iOS).
- [ ] Glisser un rayon change l'ordre et le mémorise après rechargement, pour cet utilisateur seulement.
- [ ] Un article coché est barré et passe en bas de son rayon ; décoché, il remonte ; « Vider les cochés » demande confirmation puis supprime tous les cochés et eux seuls.
- [ ] 300 articles maximum par liste, 80 caractères maximum par article, refus côté serveur avec message clair.
- [ ] Deux workspaces : aucune lecture ni écriture croisée sur les quatre tables (test d'isolation au niveau base) ; deux utilisateurs d'un même workspace : ni les corrections ni l'ordre des rayons de l'un ne sont lisibles ou modifiables par l'autre.
Partage et temps réel
- [ ] Le jeton fait 32 octets aléatoires et n'est jamais stocké en clair (test sur la base : ni `token_hash` ni `token_ciphertext` ne contiennent le jeton) ; il peut être réaffiché à tout moment par le propriétaire, avec QR code et partage natif.
- [ ] Chiffrement : deux chiffrements du même jeton donnent deux textes différents (IV aléatoire) ; un octet altéré (chiffré, IV ou tag) est refusé sans texte partiel ; un chiffré copié sur un autre lien est refusé (AAD) ; le format `v1.` est reconnu et un préfixe inconnu est refusé proprement.
- [ ] `SHARE_TOKEN_KEY` absente, de longueur ≠ 32 octets ou qui ne déchiffre pas : la feuille « Partager » affiche « Lien actif — régénérer pour l'afficher ici », sans erreur ni plantage ; créer un lien affiche le lien neuf une fois même sans clé. Les previews et la CI n'ont pas la clé (les tests fabriquent la leur en mémoire).
- [ ] Les fonctions `guest.*` ne lisent ni ne renvoient `token_ciphertext` (test sur leur définition et sur leurs résultats) ; `app_guest` ne peut pas lire la colonne ; `revealShareLink` exige session et appartenance, et n'est pas dans le canal `assistant`.
- [ ] Le QR est généré sans aucune requête réseau sortante (test : requêtes interceptées) et encode exactement l'URL affichée ; scanné avec l'appareil photo d'un iPhone, il ouvre la page invitée (vérifié sur appareil).
- [ ] Le jeton n'apparaît dans aucun journal applicatif, message d'erreur ni événement Sentry : un événement simulé portant `/l/<jeton>` (URL de requête, fil d'actions, nom de transaction, message) ressort avec `/l/[token]` (test sur `beforeSend`, comme `src/lib/sentry-client-envelope.test.ts`).
- [ ] Un jeton invalide, inconnu ou révoqué donne la même page et le même statut 404.
- [ ] Avec la connexion `app_guest`, tout accès direct à une table (SELECT/INSERT/UPDATE/DELETE) est refusé ; seules les quatre fonctions répondent ; avec un jeton valide, elles ne lisent ni n'écrivent aucune ligne hors de la liste du lien (test avec deux listes de deux workspaces) ; `item_id` d'une autre liste refusé.
- [ ] L'invité peut ajouter et cocher/décocher ; il n'existe aucun chemin pour supprimer, renommer ou vider (test : liste des fonctions accordées à `app_guest`).
- [ ] Plafonds : 31e ajout invité en 60 s refusé ; saisie de 81 caractères refusée ; 301e article refusé.
- [ ] Révoquer ou régénérer : l'ancien lien cesse de fonctionner immédiatement (lecture et écriture), le `channel_id` change, un jeton Ably d'invité n'est plus renouvelé.
- [ ] La page invitée porte `noindex` (en-tête et balise), `Referrer-Policy: no-referrer`, `no-store`, aucune ressource externe ; la CSP de la route reste sans `unsafe-inline`.
- [ ] Un ajout fait par l'invité apparaît chez Antoine, et inversement, sans recharger, en moins de 2 s sur réseau normal ; le message temps réel ne contient que `rev` (test).
- [ ] Rattrapage : après une coupure du canal, au retour au premier plan et au retour du réseau, l'écran affiche l'état courant sans action de l'utilisateur.
- [ ] Un jeton Ably d'invité ne permet de s'abonner qu'au canal de sa liste (test avec un second canal : refus).
Wishlist
- [ ] Coller un lien https public remplit titre (si vide) et image ; un lien sans métadonnées, injoignable, trop lent, trop gros, non HTML ou refusé crée le souhait sans image et sans erreur bloquante.
- [ ] Refusés (un test chacun) : `http://`, port ≠ 443, `https://user:pass@…`, `localhost`, `127.0.0.1`, `[::1]`, `10.x`, `172.16–31.x`, `192.168.x`, `169.254.169.254`, `100.64.x`, nom d'hôte qui résout vers une adresse privée, nom à deux adresses dont une privée, redirection vers une adresse privée, 4 redirections, réponse de plus de 512 Kio, délai de plus de 4 s.
- [ ] Priorité, catégorie, prix saisis à la main, acheté/non acheté ; catégories de base présentes, créer/renommer/supprimer une catégorie (les souhaits passent en « Autre ») ; isolation entre workspaces.
- [ ] Les images distantes s'affichent sans casser le reste de la CSP (vérifié en production-like, `next start`) ; repli visuel si l'image échoue.
Bucket List
- [ ] Ajouter, cocher, date optionnelle, catégorie, tri et section « faits » ; isolation entre workspaces.
Commun
- [ ] FR et EN complets (aucun texte en dur, tests `tests/i18n/`), mobile 390 px d'abord, zones tactiles ≥ 44 px, 1440 px propre.
- [ ] Chaque action du registre a un test d'isolation et un test de refus sans contexte ; les actions `assistant` sont exactement celles de la liste ci-dessus.
- [ ] Onglet « Listes » absent côté Pro ; tuile Courses fonctionnelle ; `pnpm test:build` vert (SDK Ably hors bundle initial, bibliothèque QR hors bundle client).
- [ ] CSP par route : `img-src https:` sur `/lists/wishlist` seulement, vérifié par un test sur chaque route connue (§ Wishlist) ; `connect-src` n'ouvre les origines Ably qu'aux routes qui ouvrent le canal.

## Scénarios utilisateur (joués par /qa)
1. **Courses au supermarché (iPhone)** — Antoine ouvre « Listes », tape « lait », Entrée, « 2 yaourts », Entrée, « déo », Entrée, « truc inconnu », Entrée sans que le clavier se ferme ; les articles se rangent seuls ; il coche trois articles qui descendent barrés ; « Vider les cochés » les supprime après confirmation. Mobile : oui.
2. **Corriger un classement** — « truc inconnu » est en Divers ; Antoine le passe dans Épicerie salée via le menu ; il le retape plus tard : il atterrit en Épicerie salée.
3. **Régler l'ordre du magasin** — Antoine glisse « Surgelés » en tête ; il recharge : l'ordre est gardé. Mobile : oui.
4. **Partager et compléter** — Antoine ouvre « Partager » : le lien, son QR code et le partage natif s'affichent ; il copie le lien, l'ouvre dans une fenêtre privée (ou scanne le QR avec un autre téléphone) : la personne voit la liste sans compte, ajoute « pain » et coche « lait » ; Antoine voit les deux changements apparaître seuls, avec la pastille « invité » ; Antoine coche « beurre » : la personne le voit barré sans recharger. Antoine ferme l'application, la rouvre le lendemain, rouvre « Partager » : le même lien et le même QR sont là. Mobile : oui.
5. **Limites de l'invité** — dans cette fenêtre, aucune option pour supprimer, renommer ou vider ; la page n'a ni autre lien ni autre donnée ; l'URL `/lists/shopping` demande une connexion.
6. **Régénérer et révoquer** — Antoine régénère le lien : l'ancien lien affiche « n'est plus valide » ; le nouveau est affiché et fonctionne ; l'invité de l'ancien lien ne reçoit plus rien. Antoine révoque : le nouveau meurt aussi, la feuille n'offre plus que « Créer un lien ». Variante preview (sans `SHARE_TOKEN_KEY`) : après création, la feuille rouverte affiche « Lien actif — régénérer pour l'afficher ici ».
7. **Réseau coupé** — l'invité passe en mode avion, Antoine ajoute trois articles, le réseau revient : l'invité les voit sans action.
8. **Wishlist avec lien** — Antoine colle le lien d'un produit ; titre et image apparaissent ; il saisit prix et priorité, choisit « Tech ». Variante : il colle `http://localhost:3000` : le souhait se crée sans image, aucun message d'erreur bloquant. Mobile : oui.
9. **Catégories** — Antoine crée « Jardin », renomme « Tech » en « Électronique », supprime « Jardin » : ses souhaits repassent en « Autre ».
10. **Bucket List** — Antoine ajoute « Voir les aurores boréales » (Voyages, date dans 2 ans) et la coche : elle passe dans « Faits ». Mobile : oui.
11. **Langue** — l'interface passe en anglais : rayons, catégories de base, boutons et page invitée (navigateur en anglais) suivent.
12. **Côté Pro** — Antoine bascule en Pro : l'onglet « Listes » disparaît et la tuile Courses n'est pas affichée.

## UI
- Écrans : `/lists/shopping`, `/lists/wishlist`, `/lists/bucket`, feuille « Partager », page invitée `/l/[token]`, tuiles du tableau de bord, états de chargement (givre, comme les autres pages), état vide et état d'erreur de chaque page. Maquette : aucune ; démarche : essais d'écran rapides dans la PR A, comme pour le kanban.
- Contraintes DESIGN.md : liquid glass et grille bento existants, tokens sémantiques, texte sur verre lisible (contraste vérifié), anti-slop puis `/impeccable critique`. Champ d'ajout : police ≥ 16 px (sinon zoom iOS), focus conservé après Entrée, jamais remonté ni remplacé pendant la saisie (gotchas clavier iOS). Pas d'animation de composant dans une ligne déplaçable (gotcha kanban).

## Questions (toutes tranchées par Antoine le 2026-11-28)
- [x] **Q1 — Rayons et ordre par défaut.** Validé : 11 rayons + « Divers », dans l'ordre : 1 Fruits et légumes · 2 Boulangerie et pâtisserie · 3 Boucherie, poissonnerie et charcuterie · 4 Crèmerie et œufs · 5 Épicerie salée · 6 Épicerie sucrée et petit-déjeuner · 7 Boissons · 8 Entretien et maison (PQ ici) · 9 Hygiène et soins · 10 Bébé et animaux · 11 Surgelés · Divers. Clés stables en code, libellés FR/EN.
- [x] **Q2 — Quantité.** Validé : pas de champ quantité, « 2 lait » reste du texte, pas de dédoublonnage.
- [x] **Q3 — Navigation et tuiles.** Validé : onglet « Listes » côté Privé seulement, contrôle segmenté Courses · Wishlist · Bucket List ; tuiles Courses (PR A) et Wishlist (PR C), pas de tuile Bucket List.
- [x] **Q4 — Espaces du Privé.** Validé : les trois listes ignorent le filtre d'espace.
- [x] **Q5 — Catégories de base.** Validé : Wishlist (10) Tech · Maison · Cuisine · Vêtements · Beauté et santé · Sport · Loisirs et culture · Voyage · Cadeaux · Autre ; Bucket List (8) Voyages · Aventure et sport · Culture et découvertes · Gastronomie · Apprendre · Famille et amis · Projets perso · Autre ; renommables et supprimables sauf « Autre ».
- [x] **Q6 — Durée de vie du lien et cadence.** Validé, avec changement : lien permanent **et réaffichable** (jeton chiffré, QR code, partage natif, § Partage sans compte) ; plafonds en base (300 articles, 80 caractères, 30 ajouts invités/minute) + règle de pare-feu Vercel sur `/l/*`.
- [x] **Q7 — CSP des images de la wishlist.** Validé avec précision : `img-src https:` sur la seule route `/lists/wishlist`, CSP actuelle partout ailleurs (page invitée comprise), test qui le vérifie.
- [x] **Q8 — Hors ligne.** Validé : hors périmètre, suivi dans [BRAIN-74](https://linear.app/nexxia-studio/issue/BRAIN-74).
- [x] **Q9 — Pastille « invité ».** Validé.
- [x] **Q10 — Découpage en PR.** Validé : A, B, C (permutation B ↔ C possible). Antoine crée le compte Ably avant la PR B : offre gratuite vérifiée par lui (6 M messages/mois, 200 connexions et canaux simultanés, bridée et non coupée au-delà ; ADR-011).
- [x] **Q11 — Un module ou trois.** Validé : trois modules `shopping`, `wishlist`, `bucket`.
- [x] **Q12 — Confirmation et suppression.** Validé : confirmation pour « Vider les cochés », « Annuler » 5 s pour la suppression d'un article, pas de corbeille.

## Point à trancher dans le plan (pas bloquant)
- **Q13 — Jeton dans les journaux d'exécution de Vercel.** Le jeton est dans le chemin `/l/<jeton>` : Vercel enregistre le chemin de chaque requête, hors de notre contrôle (Sentry et nos journaux sont nettoyés, § Partage sans compte). Avis : accepter, car l'accès à ces journaux est celui d'Antoine seul, que le plus grave qu'un jeton donne est d'ajouter et cocher sur une liste de courses, et qu'« Régénérer » le neutralise. Alternative écartée : jeton dans le fragment d'URL (`/l#<jeton>`, jamais envoyé au serveur), qui supprime ce risque mais impose du JavaScript avant tout affichage et abandonne le rendu serveur. À rouvrir si l'usage s'étend à des tiers moins proches.
