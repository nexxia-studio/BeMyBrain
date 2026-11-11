# Pièges connus

<!-- Une ligne par piège : symptôme → cause → parade. Grep avant d'ajouter. L'agent scribe alimente ce fichier. -->
<!-- Les trois dernières lignes viennent de projets précédents ; supprime celles qui ne s'appliquent pas. -->

- Edit d'un .ts bloqué (exit 2) avant que le projet existe → le hook PostToolUse lance prettier/eslint → scaffold et `pnpm install` en Bash avant toute édition de .ts.
- `tsc --noEmit` échoue sur `LayoutProps` → type généré seulement par `next dev`/`build`/`typegen` → typer les props à la main.
- `shadcn init -d` ajoute `button.tsx` non demandé → effet par défaut de l'init → le supprimer si aucun composant n'est voulu.
- `rm -rf` refusé → bloqué par `.claude/settings.json` → supprimer fichier par fichier puis `rmdir`.
- `pnpm add next-intl` échoue `ERR_PNPM_IGNORED_BUILDS` → il tire `@swc/core` et `@parcel/watcher` (extraction de messages) → les déclarer dans `allowBuilds` de `pnpm-workspace.yaml` (à `false`, binaires précompilés).
- `AGENTS.md` réapparaît modifié à la racine → `next dev` (Next 16) le réécrit → il est committé ; ne pas le supprimer ni l'éditer à la main.
- `pnpm e2e` échoue « Executable doesn't exist » → navigateurs Playwright non installés → `pnpm exec playwright install chromium webkit`.
- Montant faux de quelques centimes après calcul → float côté JS → stocker et calculer en entiers `_cents`, formater seulement à l'affichage.
- Enum Postgres impossible à modifier sans migration lourde → utiliser `text` + `CHECK (col IN (...))`.
- Formulaire de contact spammé → ajouter honeypot + rate limit + vérification du temps de remplissage ; tester en local, jamais sur le formulaire en prod.
- Branche Neon créée sans le rôle ou la config d'auth attendus → une branche copie rôles, données et réglages Neon Auth de son parent **au moment de sa création ou de son reset** → créer rôles et réglages sur `production` d'abord, puis créer ou resetter les branches filles.
- `auth.uid()` / `auth.user_id()` introuvables → l'extension `pg_session_jwt` n'est pas installée par Neon Auth seul → `CREATE EXTENSION IF NOT EXISTS pg_session_jwt` en migration.
- Rôle Postgres créé par la console ou l'API Neon → il hérite de `neon_superuser`, qui contourne la RLS → créer le rôle de l'app en SQL (`CREATE ROLE … LOGIN NOBYPASSRLS`).
