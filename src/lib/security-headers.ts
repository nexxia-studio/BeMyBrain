// En-têtes de sécurité HTTP (audit de la tâche 10 du socle).
// La CSP porte un nonce par requête, posé par src/proxy.ts : l'App Router injecte des scripts en ligne
// (données RSC) qu'une CSP sans nonce bloque, sauf à autoriser 'unsafe-inline'. Doc locale de Next 16 :
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// Les autres en-têtes, sans nonce, sont posés sur toutes les routes par next.config.ts.

type CspOptions = { nonce: string; isDevelopment: boolean };

/**
 * En-tête de requête interne posé par src/proxy.ts (toujours écrasé, jamais repris du client) : copie du
 * nonce de la CSP. readCspNonce ne fait confiance au nonce que s'il est présent et identique.
 */
export const CSP_NONCE_MARKER_HEADER = "x-bmb-csp-nonce";

/**
 * CSP d'une page. Polices `next/font` auto-hébergées ('self'), Neon Auth appelé côté serveur seulement
 * (aucune origine tierce dans connect-src). Sentry (tâche 19) devra ajouter son point d'ingestion.
 */
export function contentSecurityPolicy({
  nonce,
  isDevelopment,
}: CspOptions): string {
  const directives: string[][] = [
    ["default-src", "'self'"],
    // En développement, React reconstruit les piles d'erreurs serveur avec eval.
    [
      "script-src",
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    // Balises <style> : nonce en production ; en développement, Turbopack injecte les styles sans nonce.
    [
      "style-src",
      "'self'",
      isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`,
    ],
    // Attributs style="" rendus côté serveur (Motion, Next) : un nonce ne les couvre pas.
    // raccourci: attributs style autorisés — retirer si aucun composant n'en rend plus.
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:"],
    ["font-src", "'self'"],
    ["connect-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ...(isDevelopment ? [] : [["upgrade-insecure-requests"]]),
  ];
  return directives.map((parts) => parts.join(" ")).join("; ");
}

/** Nonce de 128 bits aléatoires, en base64, un par requête. */
export function createNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  );
}

/** En-têtes sans nonce, posés sur toutes les routes par next.config.ts. */
export function securityHeaders({
  isProduction,
}: {
  isProduction: boolean;
}): { key: string; value: string }[] {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    // Deux ans ; jamais en local (HTTP).
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ];
}
