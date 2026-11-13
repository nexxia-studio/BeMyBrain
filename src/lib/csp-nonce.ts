import "server-only";

import { headers } from "next/headers";

/**
 * Nonce de la CSP de la requête, posé par src/proxy.ts dans l'en-tête de requête (Next le lit au même
 * endroit pour ses propres scripts). Sert aux rares scripts en ligne de l'app ; undefined sans CSP.
 */
export async function readCspNonce(): Promise<string | undefined> {
  const policy = (await headers()).get("content-security-policy");
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}
