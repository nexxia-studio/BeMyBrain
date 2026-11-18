# Sentry (erreurs)

Dernière vérification : 2026-11-18 (tâche 19 du plan socle).

## Projet
- Projet `bemybrain`, organisation `nexxia-studio`, région UE. Configuré à la main, sans wizard ni CLI Sentry.
- Formule gratuite. Source maps reportées (BRAIN-35) : piles d'appels minifiées côté navigateur.

## Activation
- Actif seulement si `SENTRY_DSN` a une origine `https://*.sentry.io` (même règle que la CSP, `sentryDsnOrigin`) ET `VERCEL_ENV` vaut `production` ou `preview`. Un DSN mal formé ou hors sentry.io laisse Sentry inactif, sans erreur. Environnement Sentry = `VERCEL_ENV`.
- `SENTRY_DSN` posée par Antoine dans Vercel. Inactif en local, en CI, sous Vitest et Playwright.
- Le DSN est figé au build (clé `env` de `next.config.ts`), pas lu au runtime. La variable doit être cochée pour Production ET Preview (toutes les branches). Après tout changement de la variable : redéployer, sinon l'ancien build garde l'ancienne valeur.
- Garde-fou (`src/lib/sentry-build-guard.ts`) : un build Vercel `production` ou `preview` sans `SENTRY_DSN` valide (https, `*.sentry.io`) échoue, avec un message qui n'affiche pas la valeur. Aucun effet en local, en CI ni en `vercel dev`.
- Pas de tunnel : `tunnelRoute: false` explicite dans `next.config.ts`. Sans lui, le SDK crée seul une route `/sentry-tunnel` sur les builds Vercel. Avertissement de dépréciation de l'option au build : attendu.
- Options communes : `src/lib/sentry-options.ts`. Navigateur : `src/lib/sentry-client.ts` (SDK chargé à la demande). Serveur : `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`.

## Données personnelles
- Aucune : `dataCollection` tout coupé (ni IP, ni cookies, ni corps, ni query string), en-têtes en liste blanche, `user` réduit à `id`, messages masqués.
- IP non stockée côté projet Sentry (réglage du projet). Pas de session replay, pas de tracing.

## Alerte
- Une seule règle : « BeMyBrain production : nouvelle erreur ou régression → e-mail », environnement `production` seulement, au plus toutes les 5 min.
- Aucune alerte pour les previews ni le local.

## Limite
- Navigateur : le SDK est chargé après le démarrage de la page (hors bundle initial). Une erreur du navigateur survenue avant la fin de ce chargement n'est pas captée.
- Serveur : toutes les erreurs sont captées (rendu, Server Action, route), sans délai.
