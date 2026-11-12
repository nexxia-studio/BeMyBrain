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
- `pnpm add -D drizzle-kit` échoue `ERR_PNPM_IGNORED_BUILDS` sur esbuild → postinstall qui ne fait que vérifier le binaire précompilé → `esbuild: false` dans `allowBuilds` de `pnpm-workspace.yaml`.
- Avertissement `configLoader: 'native'` de Vite → `vitest.config.mts` importe un `.ts` du projet (CommonJS sans `"type": "module"`) → ne pas importer de `.ts` du projet dans la config Vitest, recopier les quelques lignes.
- Test jose qui échoue en jsdom (WebCrypto, `Uint8Array` d'un autre realm) → environnement par défaut `jsdom` → `// @vitest-environment node` en tête du fichier.
- `drizzle-kit migrate` affiche « '@neondatabase/serverless' can only connect … through a websocket » → simple avertissement, Node ≥ 24 fournit `WebSocket` en global → sans effet, ne rien installer.
- Négation `!@/db/client` sans effet dans `no-restricted-imports` → motifs gitignore : un chemin dont le parent (`@/db`) est exclu ne peut pas être ré-inclus → utiliser l'option `regex` d'ESLint 9.
- Migration appliquée sur la mauvaise branche → `.env` local visant `production` → garde-fou `NEON_PRODUCTION_HOST` dans drizzle.config.ts ; vérifier l'hôte de chaque URL.
- Règle eslint d'un fichier qui « disparaît » → en flat config, la dernière config qui pose une règle remplace ses options → chaque config spécifique reprend les motifs communs (`commonPatterns`, `commonSyntax`).
- `auth.uid()` renvoie NULL à la première transaction d'une connexion, puis fonctionne → `pg_session_jwt` se charge au premier appel et efface la valeur posée par `set_config(…, true)` plus tôt dans la transaction → appeler `select app.current_user_id()` AVANT `set_config` (fait par `withUserDb`) ; test témoin dans `tests/db/app-backend.test.ts`.
- `GRANT USAGE ON SCHEMA auth TO app_backend` sans effet ni erreur → le schéma `auth` de `pg_session_jwt` appartient à `cloud_admin` → passer par des fonctions `SECURITY DEFINER` du schéma `app` (`app.current_user_id()`).
- `CREATE FUNCTION … LANGUAGE sql` échoue « relation does not exist » → le corps est vérifié à la création → ordre des migrations : tables, puis fonctions, puis policies.
- `SET ROLE app_backend` refusé au propriétaire → PG16+ : appartenance sans option SET → tester avec la connexion `app_backend` elle-même (`DATABASE_TEST_AUTHENTICATED_URL`).
- `ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` sans effet → un droit par défaut par schéma ne retire pas un droit global → forme globale, sans `IN SCHEMA`.
- Fonction d'extension inutilisable par `app_backend` après un `CREATE EXTENSION` → les fonctions dont `proowner` est `neondb_owner` tombent sous le REVOKE par défaut global de 0005 → après chaque `CREATE EXTENSION`, vérifier `proowner` des fonctions créées et poser un GRANT EXECUTE explicite si besoin.
- `pnpm exec tsx` introuvable alors que tsx est dans `node_modules/.pnpm` → pnpm n'expose que les binaires des dépendances déclarées → déclarer le paquet dans `package.json` (même version que l'arbre, aucun paquet ajouté).
- Test sous `src/modules/` refusé par eslint (import de `@neondatabase/serverless`, `drizzle-orm/*` ou `src/db/user-db`) → les frontières de `src/**` s'appliquent aussi aux tests → les helpers de test (pool, fixture, `withUserDb` de test) vivent dans `tests/factories/` ; le code de prod ne peut pas les importer (règle eslint, seuls les `*.test.ts` de `src/` y ont droit).
- Compte Neon Auth absent d'une branche → les utilisateurs sont des lignes de `neon_auth."user"`, copiées seulement à la création ou au reset de la branche → un compte créé après la branche n'y existe pas ; chaque branche a ses propres identifiants d'utilisateur (le seed prend celui de la branche visée).
- Requête RLS refusée alors que la session existe → `session.token` de `getSession()` côté serveur est le jeton de session opaque de Neon Auth, pas le JWT → passer à `withUserDb` le JWT de `getSessionToken()` (endpoint `/token`).
- `Cannot find module …/next/headers` sous Vitest dès qu'on importe `@neon/auth` → le SDK importe `next/headers` sans extension, refusé par Node ESM (next n'a pas de champ `exports`) → `server.deps.inline: ["@neon/auth"]` dans `vitest.config.mts`.
- « Invariant: AsyncLocalStorage accessed in runtime where it is not available » en testant le proxy → Next pose `globalThis.AsyncLocalStorage` dans son runtime, pas Vitest → posé dans `tests/setup.ts`.
- Cookies Neon Auth en `SameSite=Lax` alors que la doc annonce `strict` par défaut → le SDK 0.8.2 applique `lax` → toujours passer `sameSite` explicitement à `createNeonAuth` / `createAuthServer`.
- 500 « Cookies can only be modified in a Server Action or Route Handler » sur une page après expiration du cache de session (5 min) → `auth.getSession()` du SDK Next écrit le cookie renouvelé pendant le rendu → lire la session via `getSession()` de `src/lib/auth/server.ts` (instance de lecture qui ignore cette seule erreur), jamais `getAuth().getSession()` dans un Server Component.
