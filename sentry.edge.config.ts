// Sentry côté runtime edge, chargé par src/instrumentation.ts (plan socle, tâche 19).
// Import relatif : fichier à la racine, hors de src/.
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "./src/lib/sentry-options";

const options = sentryOptions({
  SENTRY_DSN: process.env.SENTRY_DSN,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

if (options.enabled) Sentry.init(options);
