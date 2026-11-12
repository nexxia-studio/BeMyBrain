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

import { DomainError } from "@/lib/errors";

import {
  createTokenVerifier,
  createWithUserDb,
  DatabaseError,
  IdentityNotAppliedError,
  InvalidTokenError,
  type UserDb,
  type UserTx,
  type VerifiedClaims,
} from "./user-db";

const ISSUER = "https://auth.example.test";
const AUDIENCE = "https://auth.example.test";
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
    { issuer: ISSUER, audience: AUDIENCE },
  );
});

function signToken(
  privateKey: KeyPair["privateKey"],
  claims: JWTPayload = { sub: USER_ID, role: "authenticated" },
  { issuer = ISSUER, audience = AUDIENCE } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
}

function fakeDb() {
  // Par défaut, la vérification d'identité réussit (applied = true).
  const tx = {
    execute: vi.fn().mockResolvedValue({ rows: [{ applied: true }] }),
  };
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

  it("accepte un jeton signé avec l'iss et l'audience attendus", async () => {
    const token = await signToken(trusted.privateKey);

    const claims = await verify(token);

    expect(claims.sub).toBe(USER_ID);
  });

  it("refuse un iss étranger", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey, undefined, {
      issuer: "https://auth.autre-branche.example.test",
    });

    const error = await withUserDb(token, async () => "lu").catch((e) => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
    expect(error.code).toBe("ERR_JWT_CLAIM_VALIDATION_FAILED");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse une audience étrangère", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey, undefined, {
      audience: "https://app-tierce.example.test",
    });

    const error = await withUserDb(token, async () => "lu").catch((e) => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
    expect(error.code).toBe("ERR_JWT_CLAIM_VALIDATION_FAILED");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse un jeton sans audience", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await new SignJWT({ sub: USER_ID, role: "authenticated" })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(trusted.privateKey);

    const error = await withUserDb(token, async () => "lu").catch((e) => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
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

  it("n'injecte que sub, exp et un role constant, quel que soit le role du jeton", async () => {
    const { db, tx } = fakeDb();
    const verified: VerifiedClaims = {
      sub: USER_ID,
      role: "service_role",
      exp: 1763848395,
      email: "personne@example.test",
      marker: "verifie",
    };
    const stubVerify = vi.fn(async () => verified);
    const withUserDb = createWithUserDb({ verify: stubVerify, db });
    const fn = vi.fn(async (received: UserTx) => {
      expect(tx.execute).toHaveBeenCalledTimes(3);
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

  it("fn reçoit le sub du jeton vérifié comme userId", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey);

    const userId = await withUserDb(
      token,
      async (_tx, identity) => identity.userId,
    );

    expect(userId).toBe(USER_ID);
  });

  it("amorce pg_session_jwt, pose les claims, puis vérifie l'identité appliquée avant fn", async () => {
    const { db, tx } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });

    await withUserDb("jeton-brut", async () => "lu");

    const queries = tx.execute.mock.calls.map(([query]) =>
      new PgDialect().sqlToQuery(query as SQL),
    );
    expect(queries.map((q) => q.sql)).toEqual([
      "select app.current_user_id()",
      "select set_config('request.jwt.claims', $1, true)",
      "select app.current_user_id() = $1::uuid as applied",
    ]);
    expect(queries[2].params).toStrictEqual([USER_ID]);
  });

  it.each([
    ["différente", false],
    ["NULL", null],
  ])(
    "refuse d'exécuter fn si l'identité appliquée est %s, sans claims dans l'erreur",
    async (_label, applied) => {
      const { db, tx } = fakeDb();
      tx.execute
        .mockResolvedValueOnce({ rows: [{ current_user_id: null }] })
        .mockResolvedValueOnce({ rows: [{ set_config: "" }] })
        .mockResolvedValueOnce({ rows: [{ applied }] });
      const withUserDb = createWithUserDb({
        verify: async () => ({ sub: USER_ID, role: "authenticated" }),
        db,
      });
      const fn = vi.fn(async () => "lu");

      const error = await withUserDb("jeton-brut", fn).catch((e) => e);

      expect(error).toBeInstanceOf(IdentityNotAppliedError);
      expect(fn).not.toHaveBeenCalled();
      expect(`${error.message} ${error.stack}`).not.toContain(USER_ID);
    },
  );

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

  it("une erreur métier traverse withUserDb sans devenir DatabaseError", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });
    class ProbeError extends DomainError {}
    const thrown = new ProbeError("probe_failed");

    const error = await withUserDb("jeton-brut", async () => {
      throw thrown;
    }).catch((e) => e);

    expect(error).toBe(thrown);
    expect(error.code).toBe("probe_failed");
  });

  it("une erreur quelconque de fn reste masquée en DatabaseError", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });

    const error = await withUserDb("jeton-brut", async () => {
      throw new Error(`détail ${USER_ID}`);
    }).catch((e) => e);

    expect(error).toBeInstanceOf(DatabaseError);
    expect(`${error.message} ${error.stack}`).not.toContain(USER_ID);
  });

  it("un code d'erreur métier hors format ne traverse pas tel quel", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
    });
    class ProbeError extends DomainError {}

    const error = await withUserDb("jeton-brut", async () => {
      throw new ProbeError("not_found:a@b.c");
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ProbeError);
    expect(error.code).toBe("invalid_error_code");
    expect(`${error.message} ${error.stack}`).not.toContain("a@b.c");
  });
});
