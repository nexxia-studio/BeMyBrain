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

/**
 * Importe et initialise le SDK une seule fois ; `undefined` si Sentry est inactif. Import échoué (réseau,
 * déploiement remplacé) : la promesse est oubliée pour qu'un appel suivant retente, et le rejet remonte.
 */
export function loadSentry(): Promise<SentrySdk> | undefined {
  if (!options.enabled) return undefined;
  sdk ??= import("@sentry/nextjs").then(
    (Sentry) => {
      Sentry.init(options);
      return Sentry;
    },
    (error: unknown) => {
      sdk = undefined;
      throw error;
    },
  );
  return sdk;
}

/** Envoie une erreur à Sentry après son initialisation ; rien si Sentry est inactif. */
export function reportClientError(error: unknown): void {
  // SDK introuvable ou capture en panne : plus personne à qui signaler, une ligne en console (jamais muet).
  // Ce message repère aussi ce module dans la build (tests/build/initial-bundle.test.ts).
  loadSentry()
    ?.then((Sentry) => Sentry.captureException(error))
    .catch((failure: unknown) => {
      console.error("Sentry indisponible, erreur non envoyée", failure);
    });
}
