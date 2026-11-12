# ADR-010 — Migrer la production depuis GitHub Actions, jamais depuis un poste ni depuis Vercel

**Date** : 2026-11-12 · **Statut** : accepté (précise ADR-005)

## Contexte
Le 2026-11-12, une migration lancée en local a atterri sur la branche Neon `production` : le `.env` local contenait l'accès propriétaire de la production. ADR-005 dit « migrations lancées au déploiement » sans dire par qui. Lancées dans le build Vercel, elles mettraient l'URL propriétaire dans l'environnement de toutes les fonctions.

## Décision
- Les migrations de production s'appliquent par un workflow GitHub Actions, au merge dans `main`, avant le déploiement Vercel. Même commande `pnpm db:migrate` que partout (ADR-005).
- L'accès propriétaire de la production n'existe que dans les secrets GitHub (environnement protégé) et dans 1Password. Jamais dans un `.env` local, jamais dans les variables Vercel.
- En local, `drizzle.config.ts` refuse toute cible égale à `NEON_PRODUCTION_HOST` (garde-fou testé).
- Les previews migrent aussi par la CI (GitHub Actions), sur leur propre branche Neon ; leur accès propriétaire est limité à cette branche et n'existe que dans la CI.
- L'intégration Neon–Vercel est configurée pour ne pousser aucune variable propriétaire au runtime Vercel : seulement `DATABASE_AUTHENTICATED_URL` et les variables d'auth (`NEON_AUTH_*`). L'app refuse de démarrer sur Vercel si `DATABASE_URL` est définie (`src/env.ts`).
- En local et en CI, seule la plateforme fait foi (`GITHUB_ACTIONS=true` ou `VERCEL=1`) ; `CI` seule ne lève pas le garde-fou.

## Alternatives écartées
- Migration dans le build Vercel : l'URL propriétaire serait présente au runtime de toutes les fonctions.
- Migration manuelle depuis un poste : c'est la cause de l'incident.

## Conséquences
- La tâche 17 du plan socle crée ce workflow et ses secrets.
- Mot de passe propriétaire de production changé le 2026-11-12 et rangé dans 1Password.
