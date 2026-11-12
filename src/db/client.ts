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
  const jwksUrl = new URL(env.NEON_AUTH_JWKS_URL);
  const verify = createTokenVerifier(createRemoteJWKSet(jwksUrl), {
    // raccourci: issuer = origine du JWKS, comme l'exemple de la doc Neon « RLS query execution » ;
    // ni iss ni aud ne sont documentés pour Neon Auth et aucun jeton réel n'existe encore — TODO tâche 10 :
    // décoder un vrai jeton sur dev, figer iss exact et ajouter la vérification d'audience.
    issuer: jwksUrl.origin,
  });
  instance = createWithUserDb({ verify, db });
  return instance;
}

/**
 * Exécute `fn` dans une transaction du rôle app_backend, avec les claims du jeton
 * Neon Auth vérifié (signature JWKS, issuer, exp, sub) exposés à la RLS via auth.uid().
 */
export function withUserDb<T>(
  token: string,
  fn: (tx: UserTx) => Promise<T>,
): Promise<T> {
  return getInstance()(token, fn);
}
