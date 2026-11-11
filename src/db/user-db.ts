import { sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

// Seul point du code qui injecte une identité dans la base (ADR-002, plan socle).
// Interne à src/db : l'app passe par withUserDb de ./client (garde eslint).

export type UserDb = NeonDatabase;
export type UserTx = Parameters<Parameters<UserDb["transaction"]>[0]>[0];
export type VerifiedClaims = JWTPayload & { sub: string };
export type VerifyToken = (token: string) => Promise<VerifiedClaims>;

/**
 * Jeton refusé. Message fixe, sans cause chaînée (l'erreur jose peut porter le payload) :
 * on ne garde que son code (ex. ERR_JWT_EXPIRED).
 */
export class InvalidTokenError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Jeton d'authentification invalide");
    this.name = "InvalidTokenError";
    this.code = code;
  }
}

/**
 * Échec d'une requête dans withUserDb. Message fixe, sans cause chaînée ni `query` / `params`
 * (Drizzle y met les valeurs liées, dont les claims) : on ne garde que le SQLSTATE.
 */
export class DatabaseError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Erreur de base de données");
    this.name = "DatabaseError";
    this.code = code;
  }
}

function codeOf(error: unknown, pattern: RegExp): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && pattern.test(code) ? code : undefined;
}

function sqlStateOf(error: unknown): string | undefined {
  // Drizzle enveloppe l'erreur du pilote : le SQLSTATE est sur l'erreur ou sur sa cause.
  return (
    codeOf(error, /^[0-9A-Z]{5}$/) ??
    codeOf((error as { cause?: unknown } | null)?.cause, /^[0-9A-Z]{5}$/)
  );
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
    } catch (error) {
      throw new InvalidTokenError(codeOf(error, /^ERR_[A-Z_]+$/));
    }
    // sub = neon_auth.user.id (uuid), lu par auth.uid() dans les policies.
    if (!z.uuid().safeParse(payload.sub).success) {
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
    // Minimum utile aux policies : pas d'e-mail ni d'autre claim dans la session Postgres.
    const injected = {
      sub: claims.sub,
      role: claims.role,
      ...(claims.exp !== undefined && { exp: claims.exp }),
    };
    try {
      return await deps.db.transaction(async (tx) => {
        // `true` = portée transaction : les claims disparaissent au COMMIT / ROLLBACK.
        await tx.execute(
          sql`select set_config('request.jwt.claims', ${JSON.stringify(injected)}, true)`,
        );
        return fn(tx);
      });
    } catch (error) {
      // raccourci: toute erreur de fn est masquée aussi (message fixe + SQLSTATE) — distinguer les erreurs métier quand les modules en lèveront (tâche 8).
      throw new DatabaseError(sqlStateOf(error));
    }
  };
}
