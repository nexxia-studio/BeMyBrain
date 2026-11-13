import "server-only";

import { headers } from "next/headers";

import { CSP_NONCE_MARKER_HEADER } from "./security-headers";

export { CSP_NONCE_MARKER_HEADER };

/**
 * Nonce de la CSP de la requête, posé par src/proxy.ts dans l'en-tête de requête (Next le lit au même
 * endroit pour ses propres scripts). Sert aux rares scripts en ligne de l'app. undefined sans CSP, ou si
 * le marqueur du proxy manque ou diffère : un en-tête `content-security-policy` envoyé par le client sur
 * une route que le proxy n'aurait pas traitée n'est jamais repris.
 */
export async function readCspNonce(): Promise<string | undefined> {
  const store = await headers();
  const nonce = store
    .get("content-security-policy")
    ?.match(/'nonce-([^']+)'/)?.[1];
  const marker = store.get(CSP_NONCE_MARKER_HEADER);
  return nonce !== undefined && marker === nonce ? nonce : undefined;
}
