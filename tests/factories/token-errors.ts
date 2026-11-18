import { errors, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";

import {
  createTokenVerifier,
  InvalidTokenError,
  TokenVerificationUnavailableError,
} from "../../src/db/user-db";

export { InvalidTokenError, TokenVerificationUnavailableError };

const ISSUER = "https://auth.example.test";
const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";

/**
 * Ce que lève la clé distante de jose (`createRemoteJWKSet`) quand Neon Auth ne sert pas son JWKS :
 * délai dépassé, réponse non 200, JSON illisible, coupure réseau (fetch sans code), jeu de clés invalide.
 * Le jeton n'y est pour rien : panne, jamais un refus.
 */
export const JWKS_OUTAGES: [string, () => unknown][] = [
  ["délai du JWKS dépassé (ERR_JWKS_TIMEOUT)", () => new errors.JWKSTimeout()],
  [
    "JWKS en erreur HTTP (ERR_JOSE_GENERIC « Expected 200 OK »)",
    () =>
      new errors.JOSEError(
        "Expected 200 OK from the JSON Web Key Set HTTP response",
      ),
  ],
  [
    "JWKS illisible (ERR_JOSE_GENERIC, JSON)",
    () =>
      new errors.JOSEError(
        "Failed to parse the JSON Web Key Set HTTP response as JSON",
      ),
  ],
  ["coupure réseau (TypeError sans code)", () => new TypeError("fetch failed")],
  ["jeu de clés invalide (ERR_JWKS_INVALID)", () => new errors.JWKSInvalid()],
];

/** Erreur réelle de createTokenVerifier quand la clé de vérification lève `cause` sur un jeton bien formé. */
export async function verificationError(cause: unknown): Promise<unknown> {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const failingKey: JWTVerifyGetKey = async () => {
    throw cause;
  };
  const verify = createTokenVerifier(failingKey, {
    issuer: ISSUER,
    audience: ISSUER,
  });
  const token = await new SignJWT({ sub: USER_ID })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setExpirationTime("15m")
    .sign(privateKey);
  return verify(token).then(
    () => {
      throw new Error("jeton accepté : la clé simulée devait lever");
    },
    (error: unknown) => error,
  );
}

/** Erreur réelle de createTokenVerifier pour un jeton signé par une clé absente du JWKS (kid inconnu). */
// Côté jose, ERR_JWKS_NO_MATCHING_KEY n'arrive qu'avec un JWKS lu avec succès (rechargé, ou lu il y a moins de
// 30 s) : un rechargement en échec lève sa propre erreur (délai, HTTP, réseau), classée en panne.
export function unknownKeyError(): Promise<unknown> {
  return verificationError(new errors.JWKSNoMatchingKey());
}
