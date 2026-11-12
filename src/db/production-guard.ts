// Garde-fous sans dépendance contre une connexion visant la mauvaise branche Neon.
// Logique d'hôte partagée avec vitest.config.mts via scripts/neon-host.mjs.
// Les messages ne citent que des noms de variables, jamais d'hôte ni d'URL.
import {
  hostOfUrl,
  isTrustedPlatform,
  normalizeNeonHost,
  parseHostVariable,
} from "../../scripts/neon-host.mjs";

export { hostOfUrl, normalizeNeonHost };

type Source = Record<string, string | undefined>;

/** Exige que deux URL présentes visent le même endpoint (branche) Neon. */
export function assertSameHost(
  source: Source,
  first: string,
  second: string,
): void {
  const a = source[first];
  const b = source[second];
  if (!a || !b) return;
  if (hostOfUrl(a, first) !== hostOfUrl(b, second)) {
    throw new Error(
      `${first} et ${second} visent deux branches Neon différentes : elles doivent viser la même.`,
    );
  }
}

/**
 * Refuse une commande drizzle-kit ou le seed, lancés hors plateforme de confiance, contre la branche production.
 * Sur GitHub Actions et Vercel, la cible est fixée par l'environnement (ADR-010).
 */
export function assertNotProductionTarget(source: Source): void {
  if (isTrustedPlatform(source)) return;
  const productionHost = source.NEON_PRODUCTION_HOST;
  if (!productionHost) {
    throw new Error(
      "NEON_PRODUCTION_HOST manquante : obligatoire en local pour empêcher une migration ou un seed sur la production. Voir .env.example.",
    );
  }
  const production = parseHostVariable(productionHost, "NEON_PRODUCTION_HOST");
  const target = source.DATABASE_URL;
  if (!target) return; // signalé par getMigrationEnv
  if (hostOfUrl(target, "DATABASE_URL") === production) {
    throw new Error(
      "DATABASE_URL vise NEON_PRODUCTION_HOST : migration ou seed local sur la production refusé.",
    );
  }
}
