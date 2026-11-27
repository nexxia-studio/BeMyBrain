# ADR-010 — Migrer la production depuis GitHub Actions, jamais depuis un poste ni depuis Vercel

**Date** : 2026-11-12 · **Statut** : accepté (précise ADR-005)

## Contexte
Le 2026-11-12, une migration lancée en local a atterri sur la branche Neon `production` : le `.env` local contenait l'accès propriétaire de la production. ADR-005 dit « migrations lancées au déploiement » sans dire par qui. Lancées dans le build Vercel, elles mettraient l'URL propriétaire dans l'environnement de toutes les fonctions.

## Décision
- Les migrations de production s'appliquent par un workflow GitHub Actions, au merge dans `main`, avant la mise en ligne : la CI ne déploie la production qu'après une migration réussie (section « Ordre migration / mise en ligne »). Même commande `pnpm db:migrate` que partout (ADR-005).
- L'accès propriétaire de la production n'existe que dans les secrets GitHub (environnement protégé) et dans 1Password. Jamais dans un `.env` local, jamais dans les variables Vercel.
- En local, `drizzle.config.ts` refuse toute cible égale à `NEON_PRODUCTION_HOST` (garde-fou testé).
- Les previews migrent aussi par la CI (GitHub Actions), sur leur propre branche Neon ; leur accès propriétaire est limité à cette branche et n'existe que dans la CI.
- Pas d'intégration Neon–Vercel : elle n'injecte que `DATABASE_URL` (propriétaire) et des noms non configurables. Production : variables posées à la main dans Vercel. Previews (option A, 2026-11-12) : la CI pose sur Vercel, limitées à la branche git, `DATABASE_AUTHENTICATED_URL` et `NEON_AUTH_*` de la branche Neon de la preview, puis redéploie. Jeton `VERCEL_TOKEN` : portée **équipe entière** retenue par prudence (non vérifiée, 2026-11-17) ; il atteint tout projet ajouté à l'équipe nexxia-studio. À remplacer par un jeton limité au projet au renouvellement, si Vercel le propose. L'app refuse de démarrer sur Vercel si `DATABASE_URL` est définie.
- Deployment Protection de Vercel active sur les previews (vérifiée à la tâche 17).
- Avant le premier module sensible (finance, santé, contacts ou clients Nexxia), les previews partent de `staging`, sans donnée ni compte réel, plus de `production` (ADR-005, BRAIN-34, décision d'Antoine du 2026-11-17).
- En local et en CI, seule la plateforme fait foi (`GITHUB_ACTIONS=true` ou `VERCEL=1`) ; `CI` seule ne lève pas le garde-fou.

## Alternatives écartées
- Migration dans le build Vercel : l'URL propriétaire serait présente au runtime de toutes les fonctions.
- Migration manuelle depuis un poste : c'est la cause de l'incident.

## Risque accepté
Toute personne qui a l'écriture sur le dépôt peut modifier un workflow et utiliser `NEON_API_KEY` et `VERCEL_TOKEN`, donc atteindre la branche `production`. Accepté par Antoine le 2026-11-12, tant qu'il est le seul à avoir l'écriture. Protéger `production` dans Neon demande une formule payante : sans elle, seule la limitation des clés réduit ce risque : projet `bemybrain` ; `NEON_API_KEY` et `VERCEL_TOKEN` présentes seulement dans les étapes qui lancent nos scripts sans dépendance (`scripts/ci/*.mjs`), jamais après `pnpm install` dans le même job, `NODE_OPTIONS` et `BASH_ENV` vidés (une dépendance compromise ne peut ni les lire ni se faire charger par ces étapes ; audit du 2026-11-17). À revoir dès qu'un second contributeur a l'écriture.

## Formules gratuites (2026-11-16)
- Neon reste en formule gratuite (décision d'Antoine) : la branche `production` n'est **pas protégée** (suppression et reset possibles par toute clé du projet ; les branches filles héritent des mots de passe du parent, d'où leur réinitialisation par `scripts/ci/neon-branch.mjs`). Fenêtre de restauration : 6 h.
- Vercel reste en formule gratuite (Hobby).

## Ordre migration / mise en ligne (BRAIN-37, 2026-11-27)
Avant BRAIN-37, Vercel construisait `main` en parallèle de la migration : rien ne garantissait l'ordre. Deployment Checks essayé sans succès (« No configured checks found », check run comme commit status ; recherches arrêtées, décision d'Antoine). Détail et comparatif : `docs/features/brain-37-deploiement-apres-migration/spec.md`.
- `vercel.json` : plus aucun déploiement git automatique, `main` comprise. La CI est le seul déployeur (previews et production).
- `migrate-production.yml` : après une migration réussie (`needs`), le job `deploy-production` crée par l'API Vercel le déploiement de production du SHA exact du push, attend `READY` avec l'alias assigné, échoue sinon. Migration en échec ou annulée : rien n'est déployé, la production reste sur son déploiement actuel.
- API Vercel retenue contre un Deploy Hook : le hook déploie le dernier commit de la branche (pas le SHA du run) et ne rend pas l'identifiant du déploiement.
- Jeton `VERCEL_PRODUCTION_TOKEN`, environnement `production` seulement (branche `main`), lu par le seul job de déploiement, qui n'installe rien et n'a pas `DATABASE_URL`. Le job de migration (qui installe) ne voit jamais de jeton Vercel.
- Garde : le job ne déploie pas un SHA qui n'est plus la tête de `main` (un run relancé tard ne remplace pas la production par un vieux commit).
- Ordre inversé pour les migrations : l'ancien code tourne sur le nouveau schéma entre la fin de la migration et la fin du build, sans limite si le build échoue. La règle des migrations rétrocompatibles reste obligatoire (`.claude/rules/neon.md`).
- Limites assumées : le jeton `VERCEL_TOKEN` de dépôt (portée équipe) peut lui aussi créer un déploiement de production, la séparation des jetons ne restreint pas la capacité ; l'environnement `production` autorise le contournement par un administrateur (`can_admins_bypass`), acceptable à un seul administrateur ; un Deploy Hook éventuel dans Vercel contournerait l'ordre (à vérifier en tâche 6).
- À réexaminer quand la to-do (premier module à vraies données) part en production.

## Dépôt public (2026-11-16)
- `nexxia-studio/BeMyBrain` reste public jusqu'à la commercialisation, puis passe en privé (décision d'Antoine).
- Conséquences acceptées : code, docs et **journaux GitHub Actions lisibles par tous**. Le masquage de `scripts/ci/neon-branch.mjs` (hôtes, endpoints, mots de passe, URL) est donc indispensable ; l'étape 13 de la tâche 17 vérifie qu'aucun hôte n'apparaît en clair.
- Une PR de fork ne reçoit aucun secret : `preview-database.yml` échoue explicitement, aucun workflow n'utilise `pull_request_target`. Exiger l'approbation des workflows pour tout contributeur extérieur (réglage Actions du dépôt).
- Le risque « écriture sur le dépôt » ci-dessus ne change pas : public ne donne pas l'écriture.
- Rien dans le dépôt ne doit identifier l'infrastructure (id de projet Neon ou Vercel, hôtes, comptes) : vérifié le 2026-11-16.

## Conséquences
- La tâche 17 du plan socle crée ce workflow et ses secrets.
- Mot de passe propriétaire de production changé le 2026-11-12 et rangé dans 1Password.
- Jeton Vercel `github-ci-bemybrain` (secret `VERCEL_TOKEN`) créé le 2026-11-17, **expire le 2027-02-15** (portée : équipe entière) : le renouveler avant le 2027-02-08 (nouveau jeton, mise à jour du secret GitHub et de 1Password, révocation de l'ancien).
- Intégration GitHub de Neon déconnectée et sa clé de projet révoquée le 2026-11-17 (elle écrivait elle-même des secrets et variables dans le dépôt public). Seule clé Neon restante : `github-ci-bemybrain`, limitée au projet.
- Jeton Vercel `github-ci-bemybrain-production` (secret `VERCEL_PRODUCTION_TOKEN`, environnement `production`) **expire le 2027-02-25**. Rappel de renouvellement : BRAIN-73, échéance 2027-02-08, qui couvre aussi `VERCEL_TOKEN` (expire le 2027-02-15).
