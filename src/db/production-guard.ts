// Garde-fous sans dépendance contre une connexion visant la mauvaise branche Neon.
// Les messages ne citent que des noms de variables, jamais d'hôte ni d'URL.

type Source = Record<string, string | undefined>;

/** Hôte d'un endpoint Neon, sans le suffixe -pooler du premier segment. */
export function normalizeNeonHost(host: string): string {
  const [first, ...rest] = host.trim().toLowerCase().split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/** Hôte normalisé d'une URL de connexion ; erreur nommant la variable si illisible. */
export function hostOf(url: string, name: string): string {
  try {
    return normalizeNeonHost(new URL(url).hostname);
  } catch {
    // Pas de cause chaînée : l'erreur de URL porte la chaîne d'entrée.
    throw new Error(`${name} n'est pas une URL de connexion lisible.`);
  }
}

/** Exige que deux URL présentes visent le même endpoint (branche) Neon. */
export function assertSameHost(
  source: Source,
  first: string,
  second: string,
): void {
  const a = source[first];
  const b = source[second];
  if (!a || !b) return;
  if (hostOf(a, first) !== hostOf(b, second)) {
    throw new Error(
      `${first} et ${second} visent deux branches Neon différentes : elles doivent viser la même.`,
    );
  }
}

/**
 * Refuse une migration lancée en local contre la branche production.
 * En CI et sur Vercel, la cible est fixée par l'environnement : pas de contrôle.
 */
export function assertNotProductionTarget(source: Source): void {
  if (source.CI || source.VERCEL === "1") return;
  const productionHost = source.NEON_PRODUCTION_HOST;
  if (!productionHost) {
    throw new Error(
      "NEON_PRODUCTION_HOST manquante : obligatoire en local pour empêcher une migration sur la production. Voir .env.example.",
    );
  }
  const target = source.DATABASE_URL;
  if (!target) return; // signalé par getMigrationEnv
  if (hostOf(target, "DATABASE_URL") === normalizeNeonHost(productionHost)) {
    throw new Error(
      "DATABASE_URL vise NEON_PRODUCTION_HOST : migration locale sur la production refusée.",
    );
  }
}
