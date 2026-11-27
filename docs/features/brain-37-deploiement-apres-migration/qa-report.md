# Rapport de vérification — BRAIN-37

**Statut** : épreuve 1 jouée, épreuves 2 et 3 après accord d'Antoine · **Plan** : `plan.md` (tâches 7 et 8)

## Condition bloquante avant toute fusion
- [x] **Le secret `VERCEL_PRODUCTION_TOKEN` existe (confirmé par Antoine, 2026-11-27) dans GitHub → Settings → Environments → `production` → Environment secrets.** Créé par Antoine depuis 1Password, pas au niveau du dépôt. Sans lui, la fusion de cette PR migre puis échoue au déploiement ; `main` n'étant plus déployée par Vercel, la production reste sur son déploiement actuel, sans preuve de l'ordre.
- [ ] Date d'expiration du jeton `github-ci-bemybrain-production` : **2027-02-25** (donnée par Antoine). À inscrire dans ADR-010 (ligne « Conséquences », tâche 5). Rappel de renouvellement : BRAIN-73, échéance 2027-02-08 (couvre aussi `VERCEL_TOKEN`, qui expire le 2027-02-15).
- [ ] **Aucun Deploy Hook** dans Vercel (projet → Settings → Git → Deploy Hooks), vérifié par Antoine lui-même : un hook déploierait `main` sans attendre la migration. S'il en existe un, le supprimer avant la fusion.
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

## Épreuve 2 — fusion de cette PR (tâche 8)
À remplir après accord d'Antoine.

## Épreuve 3 — échec de migration provoqué (tâche 8)
À remplir.
