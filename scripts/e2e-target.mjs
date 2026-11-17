// Garde-fou des e2e connectés (lu par playwright.config.ts) : le compte e2e est un compte dédié de la
// branche `dev`, jamais de la production (décision d'Antoine, 2026-11-16). En .mjs sans dépendance, comme
// neon-host.mjs. Le message ne cite que des noms de variables, jamais d'hôte.

/**
 * Refuse une cible dont l'hôte est un domaine de `forbiddenHosts` (liste séparée par des virgules) ou l'un
 * de ses sous-domaines.
 * @param {string} baseURL
 * @param {string | undefined} forbiddenHosts
 * @returns {void}
 */
export function assertE2eTargetAllowed(baseURL, forbiddenHosts) {
  const host = new URL(baseURL).hostname.toLowerCase();
  const forbidden = (forbiddenHosts ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");
  if (forbidden.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
    throw new Error(
      "E2E_BASE_URL vise un hôte de E2E_FORBIDDEN_HOSTS (production) : e2e refusés. Le compte e2e n'existe que sur dev.",
    );
  }
}
