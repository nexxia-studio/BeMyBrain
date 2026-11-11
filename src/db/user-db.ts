import { sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";

// Seul point du code qui injecte une identité dans la base (ADR-002, plan socle).
// Interne à src/db : l'app passe par withUserDb de ./client (garde eslint).

export type UserDb = NeonDatabase;
export type UserTx = Parameters<Parameters<UserDb["transaction"]>[0]>[0];
export type VerifiedClaims = JWTPayload & { sub: string };
export type VerifyToken = (token: string) => Promise<VerifiedClaims>;

/** Jeton refusé. Le message ne contient jamais le jeton ni ses claims. */
export class InvalidTokenError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Jeton d'authentification invalide", options);
    this.name = "InvalidTokenError";
  }
}

export function createTokenVerifier(
  keys: JWTVerifyGetKey,
  options: { issuer: string },
): VerifyToken {
  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer: options.issuer,
        // Neon Auth signe en EdDSA (Ed25519), vérifié sur le JWKS de dev le 2026-11-12.
        algorithms: ["EdDSA"],
        requiredClaims: ["exp"],
      }));
    } catch (cause) {
      throw new InvalidTokenError({ cause });
    }
    if (typeof payload.sub !== "string" || payload.sub === "") {
      throw new InvalidTokenError();
    }
    return payload as VerifiedClaims;
  };
}

export function createWithUserDb(deps: {
  verify: VerifyToken;
  db: Pick<UserDb, "transaction">;
}) {
  return async function withUserDb<T>(
    token: string,
    fn: (tx: UserTx) => Promise<T>,
  ): Promise<T> {
    // Vérification AVANT toute connexion : un jeton refusé n'ouvre pas de transaction.
    const claims = await deps.verify(token);
    return deps.db.transaction(async (tx) => {
      // `true` = portée transaction : les claims disparaissent au COMMIT / ROLLBACK.
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`,
      );
      return fn(tx);
    });
  };
}
