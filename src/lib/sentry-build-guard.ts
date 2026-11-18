// Garde-fou du build Vercel (plan socle, tâche 19) : le DSN est inliné au build (clé `env` de next.config.ts).
// Une production ou une preview construite sans DSN valide aurait Sentry inactif, sans aucun signal :
// le build échoue plutôt. Même chose si le build pourrait appeler la CLI Sentry (variables de la CLI, `--webpack`, build hors Turbopack).
// Aucun effet en local, en CI (pas de VERCEL), avec VERCEL_ENV=development ni hors `next build`.
import { sentryDsnOrigin } from "./sentry-options";

export type SentryBuildEnv = {
  VERCEL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  SENTRY_DSN?: string | undefined;
  SENTRY_AUTH_TOKEN?: string | undefined;
  SENTRY_ORG?: string | undefined;
  SENTRY_PROJECT?: string | undefined;
  SENTRY_RELEASE?: string | undefined;
  SENTRY_URL?: string | undefined;
  TURBOPACK?: string | undefined;
};

// Variables lues par le plugin de build de Sentry pour appeler la CLI (release, set-commits, deploy, source maps).
// Aucune n'a de raison d'exister tant que les source maps ne sont pas branchées (BRAIN-35).
const SENTRY_CLI_VARIABLES = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_RELEASE",
  "SENTRY_URL",
] as const;

const CLI_REMEDY =
  "Aucun appel à la CLI Sentry au build tant que les source maps ne sont pas branchées : ce garde-fou sera levé volontairement avec BRAIN-35. Voir docs/runbooks/sentry.md.";

const GUARDED_ENVIRONMENTS = new Set(["production", "preview"]);

const REMEDY =
  "Dans Vercel, cocher SENTRY_DSN pour Production ET Preview (toutes les branches), au format https://<clé>@<hôte>.sentry.io/<projet>, puis redéployer. Voir docs/runbooks/sentry.md.";

/**
 * Lève une erreur si un build Vercel n'est pas production/preview, porte une variable de la CLI Sentry ou `--webpack`,
 * n'est pas construit par Turbopack, ou n'a pas de DSN https://*.sentry.io. N'affiche jamais de valeur.
 */
export function assertSentryDsnAtBuild(
  env: SentryBuildEnv,
  argv: readonly string[],
): void {
  // Condition du SDK pour reconnaître un build Vercel (setUpManagedTunnelVercelRoute).
  const isVercelBuild =
    Boolean(env.VERCEL) &&
    env.VERCEL_ENV !== "development" &&
    argv.includes("build");
  if (!isVercelBuild) return;

  // VERCEL_ENV absente (variables système non exposées) ou inattendue : on ne sait pas si
  // c'est une production ou une preview, Sentry resterait inactif sans signal. Valeur jamais affichée.
  if (
    env.VERCEL_ENV === undefined ||
    !GUARDED_ENVIRONMENTS.has(env.VERCEL_ENV)
  ) {
    throw new Error(
      "VERCEL_ENV absente ou inattendue pour ce build Vercel (production ou preview attendu) : Sentry serait inactif. Dans Vercel, activer « Automatically expose System Environment Variables », puis redéployer. Voir docs/runbooks/sentry.md.",
    );
  }

  if (!env.SENTRY_DSN) {
    throw new Error(
      `SENTRY_DSN absente pour ce build Vercel (${env.VERCEL_ENV}) : Sentry serait inactif. ${REMEDY}`,
    );
  }
  if (sentryDsnOrigin(env.SENTRY_DSN) === undefined) {
    throw new Error(
      `SENTRY_DSN invalide pour ce build Vercel (${env.VERCEL_ENV}) : https et hôte *.sentry.io attendus, Sentry serait inactif. ${REMEDY}`,
    );
  }

  // Chemins vers la CLI Sentry (plugin webpack, hook d'après compilation) : refusés. Seul le nom est affiché.
  const cliVariable = SENTRY_CLI_VARIABLES.find((name) => Boolean(env[name]));
  if (cliVariable !== undefined) {
    throw new Error(
      `${cliVariable} définie pour ce build Vercel (${env.VERCEL_ENV}) : la retirer des variables Vercel, puis redéployer. ${CLI_REMEDY}`,
    );
  }
  if (argv.includes("--webpack")) {
    throw new Error(
      `Build Vercel (${env.VERCEL_ENV}) lancé avec --webpack : le plugin webpack de Sentry pourrait appeler la CLI. Rétablir la commande de build par défaut (Turbopack), puis redéployer. ${CLI_REMEDY}`,
    );
  }
  // `next build` pose TURBOPACK avant de charger next.config (parseBundlerArgs, next/dist/cli/next-build.js) : « auto »
  // sans option, « 1 » avec --turbopack. Absente → webpack ou Rspack (IS_WEBPACK_TEST, NEXT_RSPACK,
  // NEXT_TEST_USE_RSPACK). « 0 » ou « false » : le SDK Sentry détecte webpack (detectActiveBundler). Refusé.
  if (!env.TURBOPACK || env.TURBOPACK === "0" || env.TURBOPACK === "false") {
    throw new Error(
      `Build Vercel (${env.VERCEL_ENV}) hors Turbopack refusé : avec webpack ou Rspack, le plugin de build de Sentry pourrait appeler la CLI. Rétablir la commande de build par défaut (\`next build\`), sans variable de bundler, puis redéployer. ${CLI_REMEDY}`,
    );
  }
}
