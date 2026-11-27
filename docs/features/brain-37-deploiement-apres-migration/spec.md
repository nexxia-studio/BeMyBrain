# Spec — BRAIN-37 : la production n'est mise en ligne qu'après la migration de sa base

**Créée le** : 2026-11-27 · **Statut** : validée (relecture d'Antoine du 2026-11-27) · **Plan** : `plan.md`

## Objectif
Au merge dans `main`, la production ne passe jamais en ligne avant la fin de la migration de sa base : migration réussie → déploiement de production par la CI ; migration en échec → rien n'est déployé, le job est rouge, la production reste sur son déploiement actuel.

## État actuel (vérifié le 2026-11-27)
- `vercel.json` : `deploymentEnabled` à `true` pour `main`, `false` pour le reste. Vercel construit donc `main` seul, en parallèle de `migrate-production.yml` (~50 s par run).
- Les trois derniers déploiements de production sont des déploiements git de `main` (SHA de fusion lu dans `meta.githubCommitSha`).
- Environnement GitHub `production` : politique de branches personnalisée, **`main` seule**, aucun relecteur requis. `main` n'est pas protégée.
- Secrets du dépôt : `NEON_API_KEY`, `NEON_PROJECT_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `VERCEL_TOKEN` (portée équipe entière, expire le 2027-02-15). Secrets de l'environnement `production` : `DATABASE_URL`, `SEED_OWNER_USER_ID`.
- Les previews prouvent déjà le mécanisme : avec `"**": false`, `POST /v13/deployments` avec `gitSource` (repoId, ref, sha) crée un déploiement et `GET /v13/deployments/{id}` en donne l'état (`scripts/ci/vercel-preview-env.mjs deploy`).
- Déjà essayés, ne pas refaire (ticket BRAIN-37, ADR-010) : Deployment Checks (check run puis commit status, « No configured checks found »), `vercel/repository-dispatch`, toute action tierce non épinglée.

## Décision proposée
1. `vercel.json` : `git.deploymentEnabled.main = false`. Plus aucun déploiement git automatique ; la CI est le seul déployeur, production comme previews.
2. `migrate-production.yml` : un job `deploy-production` après `migrate-production` (`needs`, sans `if: always()`), qui crée par l'API Vercel le déploiement de production du **SHA exact** du push (`target: "production"`, `gitSource` GitHub), attend l'état `READY` avec l'alias assigné, et échoue sinon.
3. Le jeton Vercel n'existe que dans ce job. Ce job n'installe rien et n'a pas `DATABASE_URL`. Le job de migration, lui, lance `pnpm install` (code de dépendance) et ne voit jamais le jeton Vercel.

## Avis tranché : API Vercel, pas Deploy Hook
| | API Vercel (`POST /v13/deployments`) | Deploy Hook |
| --- | --- | --- |
| Commit déployé | le SHA du push, exactement | le dernier commit de la branche au moment de l'appel |
| Deux merges rapprochés | chaque run déploie son SHA | un run peut déployer le SHA d'un autre run |
| Attente et état `READY` | par l'identifiant retourné | le hook rend un identifiant de job, pas de déploiement : il faut retrouver le déploiement par recherche |
| Privilège du secret | jeton d'équipe (déjà existant, même puissance) | URL secrète limitée à ce projet et cette branche : plus étroit |
| Code | `call` de `vercel-preview-env.mjs` réutilisé | nouveau chemin d'attente à écrire |

Retenu : API. Le Deploy Hook est plus étroit en privilège, mais il rompt deux exigences (SHA exact, état vérifié) et il faudrait deviner quel déploiement il a créé. Le privilège supplémentaire du jeton est déjà accepté dans ADR-010 (même jeton, mêmes limites).

Jeton : nouveau secret **`VERCEL_PRODUCTION_TOKEN`**, environnement `production` uniquement, jeton Vercel distinct de `VERCEL_TOKEN` (révocation indépendante, usage lisible dans les journaux Vercel). Le workflow le passe au script sous le nom `VERCEL_TOKEN` (`VERCEL_TOKEN: ${{ secrets.VERCEL_PRODUCTION_TOKEN }}`). Les identifiants `VERCEL_PROJECT_ID` et `VERCEL_TEAM_ID` restent ceux du dépôt : ce sont des identifiants, pas des accès.

**Réserve honnête** : un jeton Vercel ne peut pas être limité à la production ni à un projet. Tant que `VERCEL_TOKEN` (équipe entière) existe au niveau du dépôt pour les previews, tout workflow d'une branche écrite par un contributeur peut créer un déploiement de production. L'environnement `production` (branche `main` seule) protège le nouveau jeton, pas la capacité. Le risque est déjà accepté (ADR-010 : seul Antoine a l'écriture). À revoir avec le second contributeur ou si Vercel propose des jetons limités.

## Comportement détaillé
- **Merge sans nouvelle migration** : `pnpm db:migrate` ne fait rien, le job réussit, le déploiement part quand même.
- **Concurrence** : le groupe `migrate-production` existant (`cancel-in-progress: false`) sérialise les runs. Limite GitHub : un seul run attend ; si un troisième arrive, le run en attente est annulé (« Canceled », normal). Le troisième contient les commits du deuxième, donc rien ne se perd, mais le deuxième n'est jamais déployé seul.
- **Garde « tête de `main` »** : juste avant de créer le déploiement, le job lit le SHA de `main` (GitHub API, `GITHUB_TOKEN`, `contents: read`). Si ce n'est plus le SHA du run, il ne déploie pas : job vert, résumé « remplacé par `<sha7>` ». Raison : un run relancé à la main le lendemain (« Re-run all jobs ») redéploierait un vieux commit par-dessus un plus récent. Effet de bord à valider : dans la séquence A puis B rapprochés, A migre mais ne déploie pas (B suit tout de suite). Voir question 2.
- **Attente** : sondage de `GET /v13/deployments/{id}` toutes les 10 s, 15 min maximum. Succès = `readyState: READY`, `target: production`, `aliasAssigned` vrai, pas d'`aliasError`. `ERROR` ou `CANCELED` → échec. Cible différente de `production` → déploiement annulé puis échec (même garde que les previews). Délai dépassé → déploiement **annulé** avant l'échec, pour qu'un job rouge ne mette pas la production en ligne plus tard.
- **Re-déclenchement** : `forceNew=1`, comme les previews : sans lui, Vercel peut renvoyer un déploiement déjà en `ERROR` du même SHA.
- **Résumé du job** (`$GITHUB_STEP_SUMMARY`) : SHA court, état, durée. **Aucune URL** (dépôt public, décision d'Antoine du 2026-11-27), aucun jeton, aucun identifiant de projet ou d'équipe, aucun corps de réponse. Le déploiement se retrouve dans Vercel par son SHA.
- **Journaux** : dépôt public. Identifiants de projet et d'équipe masqués avant tout appel (`::add-mask::`), comme dans `vercel-preview-env.mjs`.

## Ce que l'ordre change pour les migrations
Avant : le nouveau code pouvait tourner un moment sur l'ancien schéma. Après : l'**ancien code tourne sur le nouveau schéma** entre la fin de la migration et la fin du build (quelques minutes), et sans limite si le build échoue. La règle « migrations rétrocompatibles » de `.claude/rules/neon.md` reste donc obligatoire, et son énoncé est inversé dans l'ADR (voir plan, tâche 5). Un build qui échoue après une migration réussie laisse la production sur son déploiement actuel, avec le schéma déjà migré.

## Hors périmètre
- Protection de la branche Neon `production` (formule payante), jeton Vercel limité au projet (non proposé par Vercel).
- Staging, Deployment Checks, promotion manuelle, déploiement progressif (rolling release).
- Retrait de `DATABASE_URL` côté Vercel (déjà couvert par ADR-010 et la garde du build).
- Les previews : aucun changement (`preview-database.yml`, `vercel-preview-env.mjs` hors export de `call`).

## Critères d'acceptation
- [ ] `vercel.json` : `main: false` et `**: false` ; un test le verrouille.
- [ ] `deploy-production` dépend de `migrate-production` sans `always()` ni `continue-on-error` ; un test le verrouille.
- [ ] `VERCEL_PRODUCTION_TOKEN` n'est lu que par `deploy-production`, jamais dans le job qui lance `pnpm install` ni dans un job sans environnement `production` ; `DATABASE_URL` n'est lue que par `migrate-production`.
- [ ] Le job de déploiement : `contents: read` seul, aucune action tierce hors celles déjà épinglées par SHA (checkout, setup-node), pas d'installation, `NODE_OPTIONS` et `BASH_ENV` vidés.
- [ ] Le script envoie `target: "production"`, le SHA et `forceNew=1` ; refuse un SHA qui n'est pas celui du run ; ne déploie pas quand `main` a avancé ; échoue sur `ERROR`, `CANCELED`, délai, alias en erreur, cible inattendue ; annule le déploiement sur délai ou cible inattendue ; n'écrit jamais jeton, identifiant, URL ni corps de réponse (journal et résumé).
- [ ] Merge sans migration : déploiement créé. Migration en échec : `deploy-production` « Skipped », aucun déploiement créé (vérifié sur Vercel).
- [ ] La procédure manuelle de secours est dans `docs/gotchas.md` et a été jouée une fois sur une preview.

## Scénarios de vérification (voir `plan.md`, tâche 8)
Pas de scénario navigateur : le résultat se lit dans GitHub Actions et Vercel. Trois épreuves : (1) simulation sur une preview, (2) premier vrai merge, (3) échec de migration provoqué sans toucher à la production.

## Données et sécurité
- Tables touchées : aucune. RLS : sans objet. Argent : non.
- Toutes les tâches sont `[security]` (CI, secret, production) : reviewer seul par tâche, puis `security-auditor`.
- Surface nouvelle : un jeton de déploiement de production dans l'environnement `production`. Limites : branche `main` seule, job sans installation ni checkout de dépendances, jeton distinct révocable, aucune action tierce.

## Décisions (Antoine, 2026-11-27)
- [x] **1. URL dans le résumé du job** : non. SHA court, état et durée seulement.
- [x] **2. Garde « tête de `main` »** : conservée. Un run dépassé par un push plus récent ne déploie pas.
- [x] **3. Jobs `status-pending` / `status-final`** : retirés (tâche 3 maintenue).
