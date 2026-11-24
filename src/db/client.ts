// Défense en plus : accès base, jamais dans un bundle client.
import "server-only";

import { createRemoteJWKSet } from "jose";

import { getAppEnv } from "@/env";

import { createPool } from "./pool";
import { createPooledDb } from "./transaction-retry";
import {
  createTokenVerifier,
  createWithUserDb,
  type UserIdentity,
  type UserTx,
} from "./user-db";

export {
  IdentityNotAppliedError,
  InvalidTokenError,
  TokenVerificationUnavailableError,
  type UserIdentity,
  type UserTx,
} from "./user-db";

let instance: ReturnType<typeof createWithUserDb> | undefined;

function getInstance() {
  if (instance) return instance;
  const env = getAppEnv();
  // Rôle app_backend : LOGIN, sans BYPASSRLS, soumis à la RLS.
  const pool = createPool(env.DATABASE_AUTHENTICATED_URL, "app_backend");
  // Connexion prise et rendue par transaction (createPooledDb) : une connexion morte sort du pool.
  const db = createPooledDb(pool);
  const verify = createTokenVerifier(
    createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL)),
    // Neon Auth pose iss = aud = origine de l'URL Neon Auth de la branche (doc Neon « JWT »,
    // vérifiée le 2026-11-12) ; figés par variable d'environnement, une valeur par branche.
    { issuer: env.NEON_AUTH_ISSUER, audience: env.NEON_AUTH_AUDIENCE },
  );
  instance = createWithUserDb({
    verify,
    db,
    evictIdle: pool.evictIdle,
    poolName: "app_backend",
  });
  return instance;
}

/**
 * Exécute `fn` dans une transaction du rôle app_backend, avec les claims du jeton
 * Neon Auth vérifié (signature JWKS, issuer, audience, exp, sub) exposés à la RLS via auth.uid().
 * `fn` reçoit aussi `{ userId }` = le `sub` vérifié : seule source fiable de l'utilisateur courant.
 */
export function withUserDb<T>(
  token: string,
  fn: (tx: UserTx, identity: UserIdentity) => Promise<T>,
): Promise<T> {
  return getInstance()(token, fn);
}
