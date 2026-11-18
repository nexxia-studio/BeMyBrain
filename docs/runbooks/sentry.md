# Sentry (erreurs)

Dernière vérification : 2026-11-18 (tâche 19 du plan socle).

## Projet
- Projet `bemybrain`, organisation `nexxia-studio`, région UE. Configuré à la main, sans wizard ni CLI Sentry.
- Formule gratuite. Source maps reportées (BRAIN-35) : piles d'appels minifiées côté navigateur.

## Activation
- Actif seulement si `SENTRY_DSN` est défini ET `VERCEL_ENV` vaut `production` ou `preview`. Environnement Sentry = `VERCEL_ENV`.
- `SENTRY_DSN` posée par Antoine dans Vercel (Production et Preview). Inactif en local, en CI, sous Vitest et Playwright.
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
