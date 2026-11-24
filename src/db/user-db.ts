import { sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { DomainError } from "@/lib/errors";

import { DatabaseError, sqlStateOf } from "./database-error";
import { runTransaction, type TransactionDb } from "./transaction-retry";

export { DatabaseError };

// Seul point du code qui injecte une identité dans la base (ADR-002, plan socle).
// Interne à src/db : l'app passe par withUserDb de ./client (garde eslint).

export type UserDb = NeonDatabase;
export type UserTx = Parameters<Parameters<UserDb["transaction"]>[0]>[0];
export type VerifiedClaims = JWTPayload & { sub: string };
export type VerifyToken = (token: string) => Promise<VerifiedClaims>;
/** Identité de la transaction : le `sub` du jeton vérifié, jamais une valeur fournie par l'appelant. */
export type UserIdentity = { userId: string };

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
 * Le jeton n'a pas pu être vérifié : JWKS de Neon Auth injoignable (délai, réseau), en erreur HTTP, illisible
 * ou invalide. Ni accepté ni refusé : panne, qui mène à la page d'erreur, jamais à /login (une panne ne
 * déconnecte pas, même esprit qu'AuthUnavailableError). Message fixe, sans cause chaînée : code jose seul.
 */
export class TokenVerificationUnavailableError extends Error {
  readonly code: string | undefined;
  constructor(code?: string) {
    super("Vérification du jeton indisponible");
    this.name = "TokenVerificationUnavailableError";
    this.code = code;
  }
}

// Codes jose d'un refus du jeton lui-même : expiré, claims (iss, aud, exp requis), signature, forme, algorithme.
// Comportement réel verrouillé par src/db/client.test.ts (« vrai JWKS distant de jose »), jose 6.2.17.
// - ERR_JWKS_NO_MATCHING_KEY (kid absent) = refus : createRemoteJWKSet ne le lève qu'avec un JWKS lu avec
//   succès (rechargé, ou lu il y a moins de `cooldownDuration`, 30 s par défaut) ; un rechargement en échec
//   lève sa propre erreur, classée en panne. Limite assumée : juste après une rotation de clé, pendant ces
//   30 s, un jeton légitime au nouveau kid est refusé (→ /login), sans rechargement du JWKS.
// - ERR_JOSE_NOT_SUPPORTED = panne : côté jeton, jose ne le lève que pour un en-tête `crit` inconnu, jamais
//   émis par Neon Auth ; côté JWKS, il vient de l'import d'une clé mal publiée.
// - ERR_JWKS_MULTIPLE_MATCHING_KEYS = panne : jeton sans kid face à un JWKS à plusieurs clés, jose
//   n'essaie pas chaque candidate ; c'est la publication des clés, pas le jeton, qui empêche de conclure.
// Tout le reste (ERR_JWKS_TIMEOUT, ERR_JOSE_GENERIC, ERR_JWKS_INVALID, TypeError réseau sans code…) = panne.
const TOKEN_REFUSAL_CODES = new Set([
  "ERR_JWT_EXPIRED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWS_INVALID",
  "ERR_JWT_INVALID",
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JWKS_NO_MATCHING_KEY",
]);

/**
 * Les claims posés ne sont pas ceux que lit la base (app.current_user_id() ≠ sub, ou NULL).
 * Garde-fou si pg_session_jwt change de comportement : jamais d'identité NULL en silence.
 * Message fixe, sans claims.
 */
export class IdentityNotAppliedError extends Error {
  constructor() {
    super("Identité non appliquée à la transaction");
    this.name = "IdentityNotAppliedError";
  }
}

function codeOf(error: unknown, pattern: RegExp): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && pattern.test(code) ? code : undefined;
}

export function createTokenVerifier(
  keys: JWTVerifyGetKey,
  options: { issuer: string; audience: string },
): VerifyToken {
  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        // iss et aud exacts de la branche (variables d'environnement) : un jeton d'une autre
        // branche Neon Auth ou destiné à un autre service est refusé.
        issuer: options.issuer,
        audience: options.audience,
        // Neon Auth signe en EdDSA (Ed25519), vérifié sur le JWKS de dev le 2026-11-12.
        algorithms: ["EdDSA"],
        requiredClaims: ["exp"],
      }));
    } catch (error) {
      const code = codeOf(error, /^ERR_[A-Z_]+$/);
      if (code && TOKEN_REFUSAL_CODES.has(code))
        throw new InvalidTokenError(code);
      throw new TokenVerificationUnavailableError(code);
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
  db: TransactionDb<UserTx>;
  /** Purge du pool avant une nouvelle tentative (AppPool.evictIdle). */
  evictIdle: () => Promise<void>;
  /** Rôle du pool, seul détail de la trace d'une nouvelle tentative. */
  poolName: string;
}) {
  return async function withUserDb<T>(
    token: string,
    fn: (tx: UserTx, identity: UserIdentity) => Promise<T>,
  ): Promise<T> {
    // Vérification AVANT toute connexion : un jeton refusé n'ouvre pas de transaction. Une seule fois : la
    // nouvelle tentative (BRAIN-50) reprend ces claims déjà vérifiés, sans nouvelle entrée.
    const claims = await deps.verify(token);
    // Minimum utile aux policies : pas d'e-mail ni d'autre claim dans la session Postgres.
    // role constant : aucune policy ne le lit, et un jeton ne doit pas pouvoir en choisir la valeur.
    const injected = {
      sub: claims.sub,
      role: "authenticated",
      ...(claims.exp !== undefined && { exp: claims.exp }),
    };
    // Mise en place de l'identité, rejouée en entier sur la nouvelle connexion si la première tombe avant fn.
    const setIdentity = async (tx: UserTx) => {
      // Charge pg_session_jwt AVANT set_config : chargée plus tard dans la transaction, la bibliothèque
      // redéfinit request.jwt.claims et efface la valeur locale (auth.uid() = NULL au premier appel
      // d'un backend neuf). Constaté sur Neon le 2026-11-12.
      await tx.execute(sql`select app.current_user_id()`);
      // `true` = portée transaction : les claims disparaissent au COMMIT / ROLLBACK.
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify(injected)}, true)`,
      );
      const check = await tx.execute<{ applied: boolean | null }>(
        sql`select app.current_user_id() = ${claims.sub}::uuid as applied`,
      );
      if (check.rows[0]?.applied !== true) throw new IdentityNotAppliedError();
    };
    try {
      return await runTransaction(deps, setIdentity, (tx) =>
        fn(tx, { userId: claims.sub }),
      );
    } catch (error) {
      // Erreurs de contrôle de Next levées dans fn (redirect, notFound…) : relancées telles quelles,
      // sinon masquées en DatabaseError (doc Next « unstable_rethrow », 16.4).
      unstable_rethrow(error);
      // Erreurs métier des modules : message = code, sans donnée (contrat de DomainError), donc non masquées.
      if (
        error instanceof IdentityNotAppliedError ||
        error instanceof DomainError
      )
        throw error;
      // Tout le reste (pilote, Drizzle, erreur imprévue de fn) : message fixe + SQLSTATE.
      throw new DatabaseError(sqlStateOf(error));
    }
  };
}
