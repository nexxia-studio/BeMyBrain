# Rapport de vérification — BRAIN-37

**Statut** : 3 épreuves jouées le 2026-11-27, toutes conformes ; BRAIN-37 fusionnée (PR #16, `6550b9f`) · **Plan** : `plan.md` (tâches 7 et 8)

## Condition bloquante avant toute fusion
- [x] **Le secret `VERCEL_PRODUCTION_TOKEN` existe (confirmé par Antoine, 2026-11-27) dans GitHub → Settings → Environments → `production` → Environment secrets.** Créé par Antoine depuis 1Password, pas au niveau du dépôt. Sans lui, la fusion de cette PR migre puis échoue au déploiement ; `main` n'étant plus déployée par Vercel, la production reste sur son déploiement actuel, sans preuve de l'ordre.
- [x] Date d'expiration du jeton `github-ci-bemybrain-production` (confirmée par Antoine : 25 février 2027, inscrite dans ADR-010) : **2027-02-25** (donnée par Antoine). À inscrire dans ADR-010 (ligne « Conséquences », tâche 5). Rappel de renouvellement : BRAIN-73, échéance 2027-02-08 (couvre aussi `VERCEL_TOKEN`, qui expire le 2027-02-15).
- [x] **Aucun Deploy Hook** (confirmé par Antoine, 2026-11-27) dans Vercel (projet → Settings → Git → Deploy Hooks), vérifié par Antoine lui-même : un hook déploierait `main` sans attendre la migration. S'il en existe un, le supprimer avant la fusion.
- [x] Dernier déploiement de production avant la PR : SHA `20b06d4` (merge de la PR #14). Identifiant lisible dans Vercel, non recopié ici (dépôt public).

## Épreuve 1 — avant fusion (tâche 7), jouée le 2026-11-27
**Statut** : constats 1, 2 et 3 conformes ; constat 4 (suite complète en CI) à relire avant fusion (voir plus bas).

1. **Previews inchangées** : PR #16 (brouillon). « Preview database » vert : `Migrer la base de la preview` ok, `Publier la preview` ok, la preview du dernier commit est `READY` dans Vercel (les commits `79a6e78` et `8547c46` ont chacun leur déploiement preview, `target` vide).
2. **Ordre et blocage** : branche jetable `chore/brain-37-essai-echec` (`eef2447`, migration `SELECT 1/0;` avec entrée de journal), PR de brouillon #17.
   - `Migrer la base de la preview` : **échec**. `Publier la preview` : **skipped**. `Supprimer la base de la preview` : succès (branche Neon supprimée). Aucun hôte ni URL de base dans le journal du run (0 occurrence de `ep-` ou `postgres://`).
   - Vercel : `list_deployments` pour le SHA `eef2447` renvoie **0 déploiement**.
   - Nettoyage : PR #17 fermée, branche supprimée sur GitHub et en local, jamais fusionnée.
   - Le job « Tests (branche Neon éphémère) » de #17 est rouge aussi : normal, il applique la même migration cassée.
3. **Procédure de secours** (tâche 6) : jouée sans `--prod` depuis un clone neuf, détail dans `docs/gotchas.md`. Déploiement `Preview` prêt en 34 s ; production inchangée (dernier déploiement de production : SHA `20b06d4`, avant l'essai). Clone supprimé, `vercel logout` fait, aucun `.vercel/` ni jeton dans le dépôt. Les sources envoyées venaient d'un clone sans `.env` (seul `.env.example` ; `.env.local` du `vercel link` supprimé avant le `deploy`).
4. **Verrous textuels** : `pnpm vitest run scripts/ci` vert (163). Suite complète avant la PR : `pnpm test` 3129 verts, `pnpm typecheck` vert, `pnpm lint` rouge **uniquement** à cause de `qa-screenshots/` (gitignoré, connu). Job « Tests (branche Neon éphémère) » de la PR #16 : voir l'état de la PR.

Limites de l'épreuve 1 : elle ne prouve ni la création ni l'attente d'un déploiement de production (impossible depuis une branche : l'environnement `production` n'admet que `main`). Cela se prouve au premier vrai merge (épreuve 2).

## Épreuve 2 — fusion de cette PR (PR #16, `6550b9f`), 2026-11-27
Avant : tous les checks de la PR verts (dont « Tests (branche Neon éphémère) »), brouillon sorti, fusion par commit de fusion. Aucune migration, aucun changement d'application.
- **Ordre dans GitHub Actions** (run « Production » du commit de fusion) : `Migration production (job)` succès, 22:24:07 → 22:24:30 ; `Déploiement production` succès, 22:24:34 → 22:26:03. Début du déploiement après la fin de la migration.
- **Ordre dans Vercel** : un seul déploiement `Production` pour ce SHA, `READY`, créé à 22:24:39 (après la migration), SHA = commit de fusion. Aucun déploiement « git » en double : la coupure de `main` a pris. Précédent : `20b06d4`.
- **Journal** : jeton, projet et équipe masqués ; aucune URL, aucun identifiant de déploiement, aucun hôte de base. Le résumé du job n'a pas été relu directement (le test du script le verrouille).
- **Production vivante** : `/login` répond 200 ; la release Sentry servie est `6550b9f`.
- **Sans migration** : un merge sans migration déploie bien.
- Reste non joué : deux merges rapprochés (optionnel, au premier moment où deux PR sont prêtes).

## Épreuve 3 — échec de migration provoqué, 2026-11-27
Joué sur le run de l'épreuve 2 (SHA toujours tête de `main`), secret `DATABASE_URL` de l'environnement `production` supprimé puis recréé par Antoine.
1. **Secret supprimé, run relancé** : `Migration production (job)` rouge (« DATABASE_URL » invalide), `Déploiement production` **skipped**, **aucun** nouveau déploiement dans Vercel, `/login` toujours 200 sur `6550b9f`. Journal : aucun hôte ni mot de passe.
2. **Secret recréé, première fois** : `Migration production (job)` rouge encore, déploiement skipped, aucun nouveau déploiement. Le format passait, la connexion échouait en ~1 s : valeur du secret abîmée au collage (cause non vue, secret non lisible). Confirme au passage que le blocage tient aussi pour un échec de connexion.
3. **Secret recréé, seconde fois** : migration succès (22:44:04 → 22:44:27), déploiement succès (22:44:32 → 22:46:03). Vercel : un nouveau déploiement `Production` du même SHA, `READY`, créé à 22:44:38 (après la migration, `forceNew` d'un re-run : deux déploiements du même SHA sont normaux ici). `/login` 200, release `6550b9f`. Journal sans hôte ni mot de passe.

Limite : l'épreuve prouve l'échec de migration et le retour à la normale. « Build Vercel en échec après migration réussie » reste couvert par les tests du script (`ERROR` → job rouge) et par la règle des migrations rétrocompatibles.

## Constats
- Aucun écart entre la spec et le comportement observé.
- Piège ajouté à `docs/gotchas.md` : un secret recréé abîmé fait échouer la migration en ~1 s sans message utile ; le re-coller depuis 1Password sans espace ni retour à la ligne.
