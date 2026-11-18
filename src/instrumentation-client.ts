// Sentry côté navigateur (plan socle, tâche 19). SENTRY_DSN et VERCEL_ENV sont inlinés au build par
// next.config.ts (clé `env`) : littéraux `process.env.X` obligatoires, Next ne remplace que ceux-là.
// Pas de tracing, pas d'enregistrement de session ; options et nettoyage dans src/lib/sentry-options.ts.
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry-options";

const options = sentryOptions({
  SENTRY_DSN: process.env.SENTRY_DSN,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

if (options.enabled) Sentry.init(options);
