// Sentry côté runtime edge, chargé par src/instrumentation.ts (plan socle, tâche 19).
// Import relatif : fichier à la racine, hors de src/.
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./src/lib/sentry-options";

const options = sentryOptions({
  SENTRY_DSN: process.env.SENTRY_DSN,
  VERCEL_ENV: process.env.VERCEL_ENV,
  // Posée par `next build` : Sentry coupé pendant le prérendu (src/lib/sentry-options.ts).
  NEXT_PHASE: process.env.NEXT_PHASE,
});

if (options.enabled) Sentry.init(options);
