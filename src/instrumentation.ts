// Point d'entrée d'instrumentation de Next (plan socle, tâche 19) : charge la config Sentry du runtime,
// et transmet à Sentry les erreurs de rendu, de Server Action et de route (onRequestError).
// Les en-têtes de requête joints par captureRequestError sont filtrés par beforeSend (src/lib/sentry-options.ts).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
