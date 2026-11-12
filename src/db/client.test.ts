// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  createTokenVerifier,
  createWithUserDb,
  DatabaseError,
  InvalidTokenError,
  type UserDb,
  type UserTx,
  type VerifiedClaims,
} from "./user-db";

const ISSUER = "https://auth.example.test";
const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";

type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let trusted: KeyPair;
let attacker: KeyPair;
let verify: ReturnType<typeof createTokenVerifier>;

beforeAll(async () => {
  trusted = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  attacker = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const jwk = await exportJWK(trusted.publicKey);
  verify = createTokenVerifier(
    createLocalJWKSet({ keys: [{ ...jwk, alg: "EdDSA" }] }),
    { issuer: ISSUER },
  );
});

function signToken(
  privateKey: KeyPair["privateKey"],
  claims: JWTPayload = { sub: USER_ID, role: "authenticated" },
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

function fakeDb() {
  const tx = { execute: vi.fn().mockResolvedValue(undefined) };
  const transaction = vi.fn(async (fn: (tx: UserTx) => Promise<unknown>) =>
    fn(tx as unknown as UserTx),
  );
  return { db: { transaction } as unknown as UserDb, tx, transaction };
}

describe("withUserDb", () => {
  it("refuse un jeton à la signature invalide sans ouvrir de transaction", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const forged = await signToken(attacker.privateKey);

    const run = withUserDb(forged, async () => "lu");

    await expect(run).rejects.toBeInstanceOf(InvalidTokenError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse un jeton sans sub", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey, {
      role: "authenticated",
    });

    const run = withUserDb(token, async () => "lu");

    await expect(run).rejects.toBeInstanceOf(InvalidTokenError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse un jeton dont le sub n'est pas un uuid", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey, {
      sub: "pas-un-uuid",
      role: "authenticated",
    });

    const run = withUserDb(token, async () => "lu");

    await expect(run).rejects.toBeInstanceOf(InvalidTokenError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("ne garde de la cause jose qu'un code, sans chaîner l'erreur", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const forged = await signToken(attacker.privateKey);

    const error = await withUserDb(forged, async () => "lu").catch((e) => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
    expect(error.cause).toBeUndefined();
    expect(error.code).toBe("ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
  });

  it("n'injecte que sub, role et exp des claims vérifiés", async () => {
    const { db, tx } = fakeDb();
    const verified: VerifiedClaims = {
      sub: USER_ID,
      role: "authenticated",
      exp: 1763848395,
      email: "personne@example.test",
      marker: "verifie",
    };
    const stubVerify = vi.fn(async () => verified);
    const withUserDb = createWithUserDb({ verify: stubVerify, db });
    const fn = vi.fn(async (received: UserTx) => {
      expect(tx.execute).toHaveBeenCalledTimes(2);
      return received;
    });

    const result = await withUserDb("jeton-brut", fn);

    expect(stubVerify).toHaveBeenCalledWith("jeton-brut");
    const query = new PgDialect().sqlToQuery(
      tx.execute.mock.calls[1][0] as SQL,
    );
    expect(query.sql).toBe("select set_config('request.jwt.claims', $1, true)");
    expect(query.params).toStrictEqual([
      JSON.stringify({ sub: USER_ID, role: "authenticated", exp: 1763848395 }),
    ]);
    expect(result).toBe(tx);
  });

  it("charge pg_session_jwt avant de poser les claims", async () => {
    const { db, tx } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });

    await withUserDb("jeton-brut", async () => "lu");

    const sqls = tx.execute.mock.calls.map(
      ([query]) => new PgDialect().sqlToQuery(query as SQL).sql,
    );
    expect(sqls).toEqual([
      "select app.current_user_id()",
      "select set_config('request.jwt.claims', $1, true)",
    ]);
  });

  it("une erreur SQL ne laisse passer ni params ni claims dans le message", async () => {
    const { db, tx } = fakeDb();
    const sqlError = Object.assign(
      new Error(`Failed query: select 1 params: ${USER_ID},secret-param`),
      { query: "select 1", params: [USER_ID, "secret-param"], code: "42501" },
    );
    tx.execute.mockRejectedValueOnce(sqlError);
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });

    const error = await withUserDb("jeton-brut", async () => "lu").catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(DatabaseError);
    expect(error.cause).toBeUndefined();
    expect(error).not.toHaveProperty("params");
    expect(error).not.toHaveProperty("query");
    const visible = `${error.message} ${error.stack} ${JSON.stringify(error)}`;
    expect(visible).not.toContain(USER_ID);
    expect(visible).not.toContain("secret-param");
    expect(error.code).toBe("42501");
  });
});
