import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Import relatif : next.config.ts est chargé hors des alias tsconfig.
import { assertSentryDsnAtBuild } from "./src/lib/sentry-build-guard";
import { securityHeaders } from "./src/lib/security-headers";

// next-intl sans routage i18n (ADR-007) : la locale vient de src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Sentry (plan socle, tâche 19) : une seule variable, SENTRY_DSN, posée dans Vercel (Production et Preview).
// Le navigateur en a besoin, avec VERCEL_ENV qui décide de l'activation : la clé `env` inline au build les
// littéraux `process.env.SENTRY_DSN` / `process.env.VERCEL_ENV`, dans les bundles client et serveur.
// Rien n'est écrit dans le dépôt ; un DSN est public par nature (il finit dans le navigateur), ce n'est pas
// un secret. Variable absente (local, CI) → clé omise, `undefined` au runtime, Sentry inactif.
// Build Vercel production ou preview sans DSN https://*.sentry.io, avec une variable de la CLI Sentry ou avec
// `--webpack` → le build échoue (src/lib/sentry-build-guard.ts).
assertSentryDsnAtBuild(
  {
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    SENTRY_URL: process.env.SENTRY_URL,
  },
  process.argv,
);

const sentryBuildEnv = Object.fromEntries(
  (["SENTRY_DSN", "VERCEL_ENV"] as const).flatMap((name) => {
    const value = process.env[name];
    return value ? [[name, value]] : [];
  }),
);

const nextConfig: NextConfig = {
  env: sentryBuildEnv,
  // Cache Components non adopté : l'app lit des cookies serveur partout (plan socle, § Décisions).
  // En-têtes de sécurité sur toutes les routes ; la CSP, à nonce, est posée par src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          isProduction: process.env.NODE_ENV === "production",
        }),
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Configuration écrite à la main, sans wizard ni CLI Sentry. Aucun envoi au build : pas de source maps
// (reportées, BRAIN-35 ; pas de SENTRY_AUTH_TOKEN), pas de release créée, pas de télémétrie du plugin.
export default withSentryConfig(withNextIntl(nextConfig), {
  telemetry: false,
  // Pas de tunnel (décision d'Antoine, 2026-11-18) : `false` explicite. Option absente, le SDK 11.13 écrit sur un
  // build Vercel une route publique /sentry-tunnel et une réécriture de toute requête
  // `content-type: application/x-sentry-envelope` vers elle. Option dépréciée : un avertissement au build, assumé.
  tunnelRoute: false,
  sourcemaps: { disable: true },
  release: { create: false, finalize: false },
  // Hook d'après compilation (upload, release) inutile sans source maps : pas branché du tout.
  useRunAfterProductionCompileHook: false,
  // Build webpack (`next build --webpack`, pas le nôtre) : sans cette option, le SDK ajoute son plugin webpack, dont
  // l'afterEmit appelle la CLI (set-commits, deploy) dès que SENTRY_AUTH_TOKEN est présent, même avec release.create
  // à false. Sans effet sous Turbopack. Le garde-fou du build refuse aussi `--webpack` sur Vercel.
  webpack: { disableSentryConfig: true },
  // Pas de tracing dans le socle : pas de hook de navigation à brancher.
  suppressOnRouterTransitionStartWarning: true,
  // Bundle allégé : ni débogage, ni tracing (aucun tracesSampleRate ; retirer excludeTracing le jour où on trace),
  // ni morceaux de replay (aucun replay, cf. src/lib/sentry-options.ts). Mesuré : -20 Ko gzip sur /dashboard.
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
});
