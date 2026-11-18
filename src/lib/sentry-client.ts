// Sentry côté navigateur, chargé à la demande (plan socle, tâche 19) : `@sentry/nextjs` n'entre dans aucun
// bundle initial, il n'est importé que si Sentry est actif (DSN + production/preview). Inactif (local, CI,
// tests), rien n'est téléchargé. Limite assumée : une erreur du navigateur survenue avant la fin du
// chargement n'est pas captée (docs/runbooks/sentry.md) ; le serveur, lui, capte tout.
// SENTRY_DSN et VERCEL_ENV sont inlinés au build par next.config.ts (clé `env`) : littéraux
// `process.env.X` obligatoires, Next ne remplace que ceux-là.
import { sentryOptions } from "@/lib/sentry-options";

type SentrySdk = typeof import("@sentry/nextjs");

const options = sentryOptions({
  SENTRY_DSN: process.env.SENTRY_DSN,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

let sdk: Promise<SentrySdk> | undefined;

/** Importe et initialise le SDK une seule fois ; `undefined` si Sentry est inactif. */
export function loadSentry(): Promise<SentrySdk> | undefined {
  if (!options.enabled) return undefined;
  sdk ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init(options);
    return Sentry;
  });
  return sdk;
}

/** Envoie une erreur à Sentry après son initialisation ; rien si Sentry est inactif. */
export function reportClientError(error: unknown): void {
  // Morceau du SDK introuvable (réseau, déploiement remplacé) : plus personne à qui signaler, on oublie la
  // promesse pour qu'une erreur suivante retente le chargement.
  loadSentry()
    ?.then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      sdk = undefined;
    });
}
