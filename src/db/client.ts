import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { createRemoteJWKSet } from "jose";

import { getAppEnv } from "@/env";

import { createTokenVerifier, createWithUserDb, type UserTx } from "./user-db";

export {
  IdentityNotAppliedError,
  InvalidTokenError,
  type UserTx,
} from "./user-db";

let instance: ReturnType<typeof createWithUserDb> | undefined;

function getInstance() {
  if (instance) return instance;
  const env = getAppEnv();
  // Rôle app_backend : LOGIN, sans BYPASSRLS, soumis à la RLS.
  const pool = new Pool({ connectionString: env.DATABASE_AUTHENTICATED_URL });
  // Message générique : ni URL, ni claims, ni détail de l'erreur du pilote.
  pool.on("error", () => {
    console.error("Erreur sur une connexion inactive du pool app_backend.");
  });
  const db = drizzle({ client: pool });
  const verify = createTokenVerifier(
    createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL)),
    // Neon Auth pose iss = aud = origine de l'URL Neon Auth de la branche (doc Neon « JWT »,
    // vérifiée le 2026-11-12) ; figés par variable d'environnement, une valeur par branche.
    { issuer: env.NEON_AUTH_ISSUER, audience: env.NEON_AUTH_AUDIENCE },
  );
  instance = createWithUserDb({ verify, db });
  return instance;
}

/**
 * Exécute `fn` dans une transaction du rôle app_backend, avec les claims du jeton
 * Neon Auth vérifié (signature JWKS, issuer, audience, exp, sub) exposés à la RLS via auth.uid().
 */
export function withUserDb<T>(
  token: string,
  fn: (tx: UserTx) => Promise<T>,
): Promise<T> {
  return getInstance()(token, fn);
}
