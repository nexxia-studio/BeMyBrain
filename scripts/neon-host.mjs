// Logique d'hôte Neon partagée par vitest.config.mts et src/db/production-guard.ts.
// En .mjs sans dépendance : la config Vitest ne peut pas importer un .ts du projet (docs/gotchas.md).
// Les messages ne citent que des noms de variables, jamais d'hôte ni d'URL.

const HOSTNAME =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?$/i;

/**
 * Hôte d'un endpoint Neon : minuscules, sans port, sans le suffixe -pooler du premier segment.
 * @param {string} host
 * @returns {string}
 */
export function normalizeNeonHost(host) {
  const [first, ...rest] = host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

/**
 * Hôte normalisé d'une URL de connexion ; erreur nommant la variable si illisible.
 * @param {string} url
 * @param {string} name
 * @returns {string}
 */
export function hostOfUrl(url, name) {
  try {
    return normalizeNeonHost(new URL(url).hostname);
  } catch {
    // Pas de cause chaînée : l'erreur de URL porte la chaîne d'entrée.
    throw new Error(`${name} n'est pas une URL de connexion lisible.`);
  }
}

/**
 * Valide une variable qui doit contenir un nom d'hôte seul (ni schéma, ni identifiant, ni chemin).
 * @param {string} value
 * @param {string} name
 * @returns {string} l'hôte normalisé
 */
export function parseHostVariable(value, name) {
  if (!HOSTNAME.test(value.trim())) {
    throw new Error(
      `${name} doit être un nom d'hôte seul, sans « :// », « @ » ni « / ». Voir .env.example.`,
    );
  }
  return normalizeNeonHost(value);
}

/**
 * Environnements dont la cible de base est fixée par la plateforme (ADR-010).
 * `CI` seule ne suffit pas : n'importe qui peut la poser en local.
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isTrustedPlatform(env) {
  return env.GITHUB_ACTIONS === "true" || env.VERCEL === "1";
}
