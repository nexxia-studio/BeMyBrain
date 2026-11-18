// Garde-fou du build Vercel (plan socle, tâche 19) : le DSN est inliné au build (clé `env` de next.config.ts).
// Une production ou une preview construite sans DSN valide aurait Sentry inactif, sans aucun signal :
// le build échoue plutôt. Aucun effet en local, en CI (pas de VERCEL), avec VERCEL_ENV=development ni hors `next build`.
import { sentryDsnOrigin } from "./sentry-options";

export type SentryBuildEnv = {
  VERCEL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  SENTRY_DSN?: string | undefined;
};

const GUARDED_ENVIRONMENTS = new Set(["production", "preview"]);

const REMEDY =
  "Dans Vercel, cocher SENTRY_DSN pour Production ET Preview (toutes les branches), au format https://<clé>@<hôte>.sentry.io/<projet>, puis redéployer. Voir docs/runbooks/sentry.md.";

/** Lève une erreur si un build Vercel n'est pas production/preview ou n'a pas de DSN https://*.sentry.io. N'affiche jamais de valeur. */
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
}
