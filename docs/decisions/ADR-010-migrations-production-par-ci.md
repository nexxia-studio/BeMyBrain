# ADR-010 — Migrer la production depuis GitHub Actions, jamais depuis un poste ni depuis Vercel

**Date** : 2026-11-12 · **Statut** : accepté (précise ADR-005)

## Contexte
Le 2026-11-12, une migration lancée en local a atterri sur la branche Neon `production` : le `.env` local contenait l'accès propriétaire de la production. ADR-005 dit « migrations lancées au déploiement » sans dire par qui. Lancées dans le build Vercel, elles mettraient l'URL propriétaire dans l'environnement de toutes les fonctions.

## Décision
- Les migrations de production s'appliquent par un workflow GitHub Actions, au merge dans `main`, avant le déploiement Vercel. Même commande `pnpm db:migrate` que partout (ADR-005).
- L'accès propriétaire de la production n'existe que dans les secrets GitHub (environnement protégé) et dans 1Password. Jamais dans un `.env` local, jamais dans les variables Vercel.
- En local, `drizzle.config.ts` refuse toute cible égale à `NEON_PRODUCTION_HOST` (garde-fou testé).
- Les previews migrent aussi par la CI (GitHub Actions), sur leur propre branche Neon ; leur accès propriétaire est limité à cette branche et n'existe que dans la CI.
- Pas d'intégration Neon–Vercel : elle n'injecte que `DATABASE_URL` (propriétaire) et des noms non configurables. Production : variables posées à la main dans Vercel. Previews (option A, 2026-11-12) : la CI pose sur Vercel, limitées à la branche git, `DATABASE_AUTHENTICATED_URL` et `NEON_AUTH_*` de la branche Neon de la preview, puis redéploie. Jeton `VERCEL_TOKEN` limité au projet Vercel (jeton de projet). L'app refuse de démarrer sur Vercel si `DATABASE_URL` est définie.
- Deployment Protection de Vercel active sur les previews (vérifiée à la tâche 17).
- Avant le multi-comptes (BRAIN-26), les previews partent de `staging`, plus de `production` (ADR-005).
- En local et en CI, seule la plateforme fait foi (`GITHUB_ACTIONS=true` ou `VERCEL=1`) ; `CI` seule ne lève pas le garde-fou.

## Alternatives écartées
- Migration dans le build Vercel : l'URL propriétaire serait présente au runtime de toutes les fonctions.
- Migration manuelle depuis un poste : c'est la cause de l'incident.

## Risque accepté
Toute personne qui a l'écriture sur le dépôt peut modifier un workflow et utiliser `NEON_API_KEY` et `VERCEL_TOKEN`, donc atteindre la branche `production`. Accepté par Antoine le 2026-11-12, tant qu'il est le seul à avoir l'écriture. Protéger `production` dans Neon demande une formule payante : sans elle, seule la limitation des clés (projet `bemybrain`, deux étapes de workflow) réduit ce risque. À revoir dès qu'un second contributeur a l'écriture.

## Conséquences
- La tâche 17 du plan socle crée ce workflow et ses secrets.
- Mot de passe propriétaire de production changé le 2026-11-12 et rangé dans 1Password.
