# Plan — BRAIN-37 : déploiement de production après la migration

**Spec** : `spec.md` · **Branche** : `feat/brain-37-deploiement-apres-migration` · **Créé le** : 2026-11-27

Aucune nouvelle dépendance, aucune action tierce nouvelle. Toutes les tâches sont `[security]` (CI, secret, production) : reviewer seul par tâche, puis `security-auditor`. Tests : `pnpm vitest run <fichier>` ; suite complète une seule fois avant la PR.
Les tâches 1 à 5 se livrent dans **une seule PR** : `vercel.json` (tâche 4) et le job de déploiement (tâche 2) doivent arriver ensemble, sinon la production n'a plus de déployeur ou en a deux.

## Prérequis d'Antoine (avant la fusion, pas avant le code)
- Créer dans Vercel un jeton **`github-ci-bemybrain-production`** (portée équipe, expiration la plus courte raisonnable, noter la date).
- GitHub → Settings → Environments → `production` → Environment secrets → **`VERCEL_PRODUCTION_TOKEN`**. Collé depuis 1Password. Pas au niveau du dépôt, pas de variable.
- Rien d'autre : `VERCEL_PROJECT_ID` et `VERCEL_TEAM_ID` (dépôt) sont réutilisés.
- Sans ce secret, la fusion échoue proprement (migration faite, déploiement refusé « VERCEL_TOKEN manquante », production inchangée) : voir tâche 8.

## Décisions prises (Antoine, 2026-11-27)
Pas d'URL dans le résumé (SHA court, état, durée) ; garde « tête de `main` » conservée ; jobs de statut retirés (tâche 3 maintenue).

## Tâches
- [x] **1. Script de déploiement de production** [security]
  - Fichiers : `scripts/ci/vercel-production-deploy.mjs`, `scripts/ci/vercel-production-deploy.test.ts`, `scripts/ci/vercel-preview-env.mjs` (seul changement : `export` devant `call`).
  - Tests à écrire d'abord (faux `fetch`, comme `vercel-preview-env.test.ts`) :
    - « envoie `target: production`, le SHA, le dépôt et `forceNew=1`, avec le nom du projet lu par `GET /v9/projects` (pas son identifiant) » ;
    - « refuse un SHA qui n'a pas 40 caractères hexadécimaux » ;
    - « ne crée aucun déploiement quand `main` est passée à un autre SHA, écrit « remplacé par `<sha7>` » dans le résumé, sort en succès » ;
    - « attend `READY` avec alias assigné, puis écrit SHA court, état et durée dans le résumé, sans aucune URL (ni celle du déploiement, ni un alias, ni le lien du tableau de bord) » ;
    - « échoue sur `ERROR`, `CANCELED`, `aliasError` » ;
    - « annule le déploiement puis échoue quand la cible renvoyée n'est pas `production` » ;
    - « annule le déploiement puis échoue au délai dépassé (15 min simulées par `sleep` factice) » ;
    - « n'écrit nulle part jeton, identifiant de projet ou d'équipe, URL, corps de réponse (journal et résumé) » ; « masque projet et équipe avant tout appel » ;
    - « réessaie 429 et 5xx sans créer deux déploiements du même appel réussi » (comportement de `call`, vérifié sur le POST).
  - Variables lues : `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `SHA`, `GITHUB_REPOSITORY`, `GITHUB_REPOSITORY_ID`, `GH_TOKEN`, `DEFAULT_GIT_BRANCH`, `GITHUB_STEP_SUMMARY`. Aucune lecture hors de cette liste.
  - Fini quand : tests verts, lint et typecheck verts, `vercel-preview-env.test.ts` inchangé et vert.
- [x] **2. Job `deploy-production` dans le workflow** [security]
  - Fichiers : `.github/workflows/migrate-production.yml`, `scripts/ci/workflows.test.ts`.
  - Job : `needs: migrate-production` (sans `if: always()`), `environment: production`, `permissions: contents: read`, `timeout-minutes: 30`, checkout et setup-node aux SHA déjà épinglés, **aucune installation**, une étape `node scripts/ci/vercel-production-deploy.mjs` avec `VERCEL_TOKEN: ${{ secrets.VERCEL_PRODUCTION_TOKEN }}`, `NODE_OPTIONS: ""`, `BASH_ENV: ""`, `SHA: ${{ github.sha }}`. Nom affiché : « Déploiement production ».
  - Tests à écrire d'abord (mêmes verrous textuels que l'existant) : « `deploy-production` attend `migrate-production`, sans `always()` ni `continue-on-error` » ; « `VERCEL_PRODUCTION_TOKEN` n'apparaît que dans ce job » ; « `DATABASE_URL` et `SEED_OWNER_USER_ID` n'apparaissent que dans `migrate-production` » ; « aucune étape `pnpm`/`npm` dans `deploy-production` » ; « aucune `uses:` hors de celles épinglées » (test existant) ; « aucun `secrets.VERCEL_TOKEN` dans ce workflow » ; test existant « la migration seule porte l'environnement `production` » adapté : deux jobs, `contents: read` seul chacun ; « le groupe de concurrence reste `migrate-production`, sans annulation ».
  - Attention : le test « aucune permission large » refuse le mot `deployments` n'importe où dans le fichier (commentaires compris).
  - Fini quand : tests verts, lint et typecheck verts.
- [x] **3. Retirer `status-pending` et `status-final`** [security] — *maintenue, décision du 2026-11-27*
  - Fichiers : `.github/workflows/migrate-production.yml`, `scripts/ci/workflows.test.ts`.
  - Tests à adapter d'abord : « deux jobs, dans l'ordre : migration, déploiement » ; retrait des verrous sur les statuts ; « `statuses: write` n'existe dans aucun workflow » (le test actuel exige `migrate-production.yml`).
  - Fini quand : plus aucun `gh api … statuses` dans les workflows, tests verts.
- [x] **4. Couper le déploiement git de `main`** [security]
  - Fichiers : `vercel.json`, `scripts/ci/vercel-json.test.ts`.
  - Test à écrire d'abord : « `deploymentEnabled` vaut `false` pour `main` et pour `**` » (lecture de `vercel.json`, aucun parseur nouveau : `JSON.parse`).
  - Fini quand : test vert. Les previews ne changent pas (`**` déjà à `false`).
- [x] **5. Bascule des documents** [security]
  - Fichiers : `docs/decisions/ADR-010-migrations-production-par-ci.md`, `.claude/rules/neon.md`, `docs/gotchas.md`.
  - ADR-010 : la section « Proposition BRAIN-37 » (déjà écrite, non en vigueur) devient « Ordre migration / mise en ligne » ; la section « Limite » disparaît ; ligne 9 et « Conséquences » mises à jour (nouveau jeton, date d'expiration réelle à rappeler avant). `neon.md` ligne 17 : l'ancien code tourne sur le nouveau schéma. `gotchas.md` : retirer l'entrée « Production mise en ligne avant la fin de sa migration » et la mention « les trois jobs restent », garder l'entrée Deployment Checks (leçon), activer la procédure de secours.
  - Fini quand : aucun document ne décrit encore le déploiement parallèle ; `grep -rn "BRAIN-37" docs .claude` ne montre que l'état « fait ».
- [ ] **6. Procédure de secours jouée sur une preview** [security]
  - Contenu : `docs/gotchas.md`, entrée « CI de production en panne » (écrite avec ce plan, à valider ici).
  - Épreuve : sur la branche de la PR, rejouer la procédure `vercel deploy` **sans `--prod`** depuis une copie propre du commit, vérifier qu'elle ne dépend d'aucun jeton stocké (`vercel login` personnel) et qu'elle n'atteint pas la production.
  - Vérifier aussi dans le tableau Vercel du projet qu'**aucun Deploy Hook** n'existe (il contournerait l'ordre) ; en supprimer un s'il existe, après accord d'Antoine.
  - Fini quand : l'entrée dit ce qui a été réellement tapé et vu ; ajustée si l'essai la contredit.
- [ ] **7. Épreuve 1 : preview (avant fusion)**
  - Voir « Plan de vérification », épreuve 1. Rapport dans `qa-report.md` (qu'Antoine lit avant d'autoriser la fusion).
- [ ] **8. Épreuves 2 et 3 : premier vrai merge, puis échec provoqué** (après accord d'Antoine pour fusionner)
  - Voir « Plan de vérification ». `/qa` n'a pas de scénario navigateur ici : le rapport `qa-report.md` consigne les constats GitHub et Vercel.

## Plan de vérification

### Ce que prouve une preview, et ce qu'elle ne prouve pas
Une preview ne peut pas créer de déploiement de production : l'environnement `production` n'admet que la branche `main`, donc aucun run d'une branche de feature ne peut lire `VERCEL_PRODUCTION_TOKEN`. C'est voulu. Le chemin « création + attente en production » n'est donc prouvé qu'au premier vrai merge, après avoir été couvert par les tests au faux `fetch` (tâche 1). Ce premier merge est cette PR, sans migration ni changement d'application ; son échec possible laisse la production sur son déploiement actuel (procédure de secours, tâche 6).

### Épreuve 1 — avant fusion, sur la PR
1. **Previews inchangées** : la CI « Preview database » de la PR est verte et la preview se déploie (le `vercel.json` modifié ne touche pas `**`). Constat : Actions → « Preview database » → jobs verts ; Vercel → Deployments → un déploiement `Preview` du dernier commit de la PR.
2. **Ordre et blocage sur la même mécanique GitHub** (`needs`) : sur une branche jetable `chore/brain-37-essai-echec`, jamais fusionnée, ajouter une migration volontairement en échec (`SELECT 1/0;`, entrée de journal comprise) et ouvrir une PR de brouillon. Constat : `Migrer la base de la preview` rouge, `Publier la preview` « Skipped », aucun déploiement Vercel pour ce commit, branche Neon de la preview supprimée par `Supprimer la base de la preview`. Fermer la PR, supprimer la branche.
3. **Procédure de secours** : tâche 6.
4. **Verrous textuels** : `pnpm vitest run scripts/ci` vert (ordre, secrets, jobs).

### Épreuve 2 — le premier vrai merge, qui est cette PR elle-même (accord d'Antoine requis)
Le premier vrai merge est la PR de BRAIN-37 : aucune migration, aucun changement d'application, et son `vercel.json` coupe le déploiement git de `main`. Le déploiement de production de son commit de fusion est donc créé par la CI, et par elle seule : c'est ce run qui sert de preuve.
**Condition bloquante** : le secret `VERCEL_PRODUCTION_TOKEN` doit exister dans l'environnement `production` avant la fusion (inscrite en tête de `qa-report.md`). Sans lui, la migration passe, le déploiement échoue « VERCEL_TOKEN manquante » et, `main` n'étant plus déployée par Vercel, la production reste sur son déploiement actuel : sans casse, mais sans preuve.
Autre condition : dernier déploiement de production noté (identifiant et SHA).
Constats, avec la commande qui les donne :
- **Ordre dans GitHub Actions** : run « Production » du commit de fusion, deux jobs : `Migration production (job)` vert, puis `Déploiement production` démarré **après** la fin du premier.
  `gh run view <id> --json jobs --jq '.jobs[] | {name, conclusion, startedAt, completedAt}'` : `startedAt` du déploiement ≥ `completedAt` de la migration.
- **Ordre dans Vercel** : Deployments → un seul déploiement `Production` pour ce SHA, créé après `completedAt` de la migration, `READY`, SHA = commit de fusion (colonne source / `meta.githubCommitSha`). Un seul : s'il y en a deux (un « git », un « API »), la coupure de `main` n'a pas pris.
  Depuis Claude : `list_deployments` avec `target=production` et `sha=<sha>`.
- **Résumé du job** : SHA court, `READY`, durée, aucune URL ; ni jeton ni identifiant de projet ou d'équipe dans le journal ni dans le résumé (public).
- **Production vivante** : l'application répond sur son adresse de production, la nouvelle version est servie (ex. SHA ou changement visible).
- **Sans migration** : cette PR n'en porte pas, ce qui prouve aussi « un merge sans migration déploie quand même ». Le premier merge suivant qui porte une migration vérifie la chaîne complète.
- **Deux merges rapprochés** (optionnel, au premier moment où deux PR sont prêtes) : fusionner les deux à quelques secondes. Constat : un run actif, un en attente ; le premier ne déploie pas s'il n'est plus la tête de `main` (« remplacé par »), le second déploie.

### Épreuve 3 — une migration en échec bloque le déploiement sans casser la production
Sans toucher au dépôt ni à la base :
1. Noter le déploiement de production courant (identifiant, SHA).
2. GitHub → Environments → `production` → supprimer le secret `DATABASE_URL` (la valeur reste dans 1Password).
3. Relancer le dernier run « Production » (« Re-run all jobs », SHA toujours en tête de `main`).
4. Constats : `Migration production (job)` rouge, `Déploiement production` « Skipped », **aucun** nouveau déploiement dans Vercel (liste inchangée), l'application répond toujours, sur le même déploiement. Relire le journal public du run : aucun hôte ni mot de passe ; sinon supprimer les journaux du run et le dire (gotchas du 2026-11-23 : le pilote peut afficher la connexion).
5. Recréer `DATABASE_URL` depuis 1Password, relancer le run : tout passe, ce qui donne une seconde preuve de l'ordre.
Cette épreuve prouve l'échec de migration. Elle ne prouve pas « build Vercel en échec après migration réussie » : couvert par les tests (`ERROR` → job rouge) et par la règle des migrations rétrocompatibles (la production reste sur l'ancien déploiement, déjà sur le nouveau schéma).

### Si quelque chose tourne mal au premier merge
- Déploiement absent ou job rouge : la production reste sur son déploiement actuel. Relancer le job de déploiement seul (« Re-run failed jobs ») s'il s'agit d'un incident passager ; sinon procédure de secours (`docs/gotchas.md`).
- Retour arrière complet : revert de la PR (remet `main: true` dans `vercel.json`, Vercel déploie de nouveau `main` seul, au prix de l'ordre non garanti, comme avant).

## Corrections QA
<!-- Alimenté par /qa. -->

## Terminé
<!-- scribe déplace ici les tâches cochées avec la date. -->
