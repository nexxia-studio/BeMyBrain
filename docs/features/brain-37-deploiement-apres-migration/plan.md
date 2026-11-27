# Plan — BRAIN-37 : déploiement de production après la migration

**Spec** : `spec.md` · **Branche** : `feat/brain-37-deploiement-apres-migration` · **Créé le** : 2026-11-27 · **Fusionné** : 2026-11-27 (PR #16, `6550b9f`)

Aucune nouvelle dépendance, aucune action tierce nouvelle. Toutes les tâches sont `[security]` (CI, secret, production) : reviewer seul par tâche, puis `security-auditor`. Tests : `pnpm vitest run <fichier>` ; suite complète une seule fois avant la PR.

## Prérequis d'Antoine (avant la fusion, pas avant le code)
- Créer dans Vercel un jeton **`github-ci-bemybrain-production`** (portée équipe, expiration la plus courte raisonnable, noter la date).
- GitHub → Settings → Environments → `production` → Environment secrets → **`VERCEL_PRODUCTION_TOKEN`**. Collé depuis 1Password. Pas au niveau du dépôt, pas de variable.
- Rien d'autre : `VERCEL_PROJECT_ID` et `VERCEL_TEAM_ID` (dépôt) sont réutilisés.

## Décisions prises (Antoine, 2026-11-27)
Pas d'URL dans le résumé (SHA court, état, durée) ; garde « tête de `main` » conservée ; jobs de statut retirés (tâche 3 maintenue).

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
Aucune correction. Constats et épreuves : `qa-report.md`.

## Terminé
- 2026-11-27 — tâche 1 : script de déploiement de production `scripts/ci/vercel-production-deploy.mjs` et ses tests [security].
- 2026-11-27 — tâche 2 : job `deploy-production` après `migrate-production` (sans `if: always()`) [security].
- 2026-11-27 — tâche 3 : statuts de commit `status-pending` et `status-final` retirés [security].
- 2026-11-27 — tâche 4 : `vercel.json` coupe le déploiement git de `main` [security].
- 2026-11-27 — tâche 5 : ADR-010 « Ordre migration / mise en ligne », `neon.md`, `gotchas.md` [security].
- 2026-11-27 — tâche 6 : procédure de secours jouée sur une preview, sans `--prod` [security].
- 2026-11-27 — tâche 7 : épreuve 1 (preview, avant fusion), rapport dans `qa-report.md`.
- 2026-11-27 — tâche 8 : épreuves 2 et 3 jouées après fusion (PR #16, `6550b9f`). Reste optionnel : « deux merges rapprochés ».
