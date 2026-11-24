// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  createLocalJWKSet,
  createRemoteJWKSet,
  customFetch,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { notFound, redirect } from "next/navigation";

import { DomainError } from "@/lib/errors";

import {
  JWKS_OUTAGES,
  unknownKeyError,
  verificationError,
} from "../../tests/factories/token-errors";

import {
  createTokenVerifier,
  createWithUserDb,
  DatabaseError,
  IdentityNotAppliedError,
  InvalidTokenError,
  TokenVerificationUnavailableError,
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

// Nouvelle tentative (BRAIN-50) : testée dans user-db.test.ts et transaction-retry.test.ts.
const RETRY = { evictIdle: async () => undefined, poolName: "test" };

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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
    const forged = await signToken(attacker.privateKey);

    const run = withUserDb(forged, async () => "lu");

    await expect(run).rejects.toBeInstanceOf(InvalidTokenError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse un jeton expiré sans ouvrir de transaction", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
    const expired = await new SignJWT({ sub: USER_ID, role: "authenticated" })
      .setProtectedHeader({ alg: "EdDSA" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(trusted.privateKey);

    const run = withUserDb(expired, async () => "lu");

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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
    const token = await signToken(trusted.privateKey, {
      role: "authenticated",
    });

    const run = withUserDb(token, async () => "lu");

    await expect(run).rejects.toBeInstanceOf(InvalidTokenError);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("refuse un jeton dont le sub n'est pas un uuid", async () => {
    const { db, transaction } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify: stubVerify, db, ...RETRY });
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
    const withUserDb = createWithUserDb({ verify, db, ...RETRY });
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
      ...RETRY,
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
      ...RETRY,
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
      ...RETRY,
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
      ...RETRY,
    });
    class ProbeError extends DomainError {}
    const thrown = new ProbeError("probe_failed");

    const error = await withUserDb("jeton-brut", async () => {
      throw thrown;
    }).catch((e) => e);

    expect(error).toBe(thrown);
    expect(error.code).toBe("probe_failed");
  });

  it.each([
    ["redirect", () => redirect("/no-workspace")],
    ["notFound", () => notFound()],
  ])(
    "relance telle quelle l'erreur de contrôle de Next levée par %s dans fn",
    async (_label, control) => {
      const { db } = fakeDb();
      const withUserDb = createWithUserDb({
        verify: async () => ({ sub: USER_ID, role: "authenticated" }),
        db,
      ...RETRY,
      });
      let thrown: unknown;

      const error = await withUserDb("jeton-brut", async () => {
        try {
          control();
        } catch (e) {
          thrown = e;
          throw e;
        }
      }).catch((e: unknown) => e);

      expect(error).toBe(thrown);
      expect(error).not.toBeInstanceOf(DatabaseError);
    },
  );

  it("une erreur quelconque de fn reste masquée en DatabaseError", async () => {
    const { db } = fakeDb();
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: USER_ID, role: "authenticated" }),
      db,
      ...RETRY,
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
      ...RETRY,
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

describe("vérification du jeton : panne du JWKS distincte d'un jeton refusé (audit QA-1)", () => {
  it.each(JWKS_OUTAGES)(
    "%s : panne de vérification, jamais un jeton refusé",
    async (_label, outage) => {
      const error = await verificationError(outage());

      expect(error).toBeInstanceOf(TokenVerificationUnavailableError);
      expect(error).not.toBeInstanceOf(InvalidTokenError);
    },
  );

  it("la panne garde un message fixe, sans cause chaînée", async () => {
    const error = (await verificationError(
      new TypeError("fetch failed https://auth.example.test/jwks"),
    )) as Error;

    expect(error.message).toBe("Vérification du jeton indisponible");
    expect(error.cause).toBeUndefined();
  });

  it("garde le code jose de la panne, pas son message", async () => {
    const [, timeout] = JWKS_OUTAGES[0];

    const error = (await verificationError(timeout())) as { code?: string };

    expect(error.code).toBe("ERR_JWKS_TIMEOUT");
  });

  it("une clé inconnue d'un JWKS lu avec succès (kid absent) est un jeton refusé", async () => {
    const error = await unknownKeyError();

    expect(error).toBeInstanceOf(InvalidTokenError);
  });

  it("withUserDb laisse passer la panne telle quelle, sans ouvrir de transaction", async () => {
    const { db, transaction } = fakeDb();
    const outage = new TokenVerificationUnavailableError("ERR_JWKS_TIMEOUT");
    const withUserDb = createWithUserDb({
      verify: async () => {
        throw outage;
      },
      db,
      ...RETRY,
    });

    const run = withUserDb("eyJ.jwt.signe", async () => "lu");

    await expect(run).rejects.toBe(outage);
    expect(transaction).not.toHaveBeenCalled();
  });
});

// Comportement réel de jose (createRemoteJWKSet, comme src/db/client.ts) sans réseau : le JWKS est servi par
// un fetch simulé (`customFetch` de jose). Verrouille le classement refus / panne si jose change.
describe("vérification du jeton contre un vrai JWKS distant de jose", () => {
  type Jwk = Awaited<ReturnType<typeof exportJWK>>;
  type Mode = "ok" | "down" | "500";

  async function jwk(pair: KeyPair, kid: string): Promise<Jwk> {
    return { ...(await exportJWK(pair.publicKey)), kid, alg: "EdDSA" };
  }

  /** JWKS distant servi par un fetch simulé ; `mode` et `keys` modifiables entre deux vérifications. */
  function remoteVerifier(
    keys: Jwk[],
    options: { cooldownDuration?: number } = {},
  ) {
    const state = { mode: "ok" as Mode, keys };
    const fetchJwks = async () => {
      if (state.mode === "down") throw new TypeError("fetch failed");
      if (state.mode === "500") return new Response("panne", { status: 500 });
      return Response.json({ keys: state.keys });
    };
    const keySet = createRemoteJWKSet(
      new URL("https://auth.example.test/jwks"),
      {
        [customFetch]: fetchJwks,
        ...options,
      },
    );
    return {
      state,
      verify: createTokenVerifier(keySet, {
        issuer: ISSUER,
        audience: AUDIENCE,
      }),
    };
  }

  function sign(pair: KeyPair, kid?: string) {
    return new SignJWT({ sub: USER_ID })
      .setProtectedHeader(kid ? { alg: "EdDSA", kid } : { alg: "EdDSA" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime("5m")
      .sign(pair.privateKey);
  }

  async function outcome(
    verify: ReturnType<typeof createTokenVerifier>,
    token: string,
  ) {
    return verify(token).then(
      () => "accepté",
      (error: unknown) =>
        error instanceof InvalidTokenError
          ? "refusé"
          : error instanceof TokenVerificationUnavailableError
            ? "panne"
            : "imprévu",
    );
  }

  it("accepte un jeton valide signé par une clé du JWKS", async () => {
    const { verify } = remoteVerifier([await jwk(trusted, "a")]);

    const result = await outcome(verify, await sign(trusted, "a"));

    expect(result).toBe("accepté");
  });

  it("kid inconnu après un rechargement réussi du JWKS : jeton refusé", async () => {
    const { verify } = remoteVerifier([await jwk(trusted, "a")], {
      cooldownDuration: 0,
    });
    await verify(await sign(trusted, "a"));

    const result = await outcome(verify, await sign(attacker, "inconnu"));

    expect(result).toBe("refusé");
  });

  it("kid inconnu et JWKS en erreur HTTP 500 au rechargement : panne", async () => {
    const { verify, state } = remoteVerifier([await jwk(trusted, "a")], {
      cooldownDuration: 0,
    });
    await verify(await sign(trusted, "a"));
    state.mode = "500";

    const result = await outcome(verify, await sign(attacker, "inconnu"));

    expect(result).toBe("panne");
  });

  it("JWKS injoignable (réseau coupé) : panne", async () => {
    const { verify, state } = remoteVerifier([await jwk(trusted, "a")]);
    state.mode = "down";

    const result = await outcome(verify, await sign(trusted, "a"));

    expect(result).toBe("panne");
  });

  it("jeton sans kid et JWKS à deux clés : panne (jose n'essaie pas chaque candidate)", async () => {
    const { verify } = remoteVerifier([
      await jwk(trusted, "a"),
      await jwk(attacker, "b"),
    ]);

    const result = await outcome(verify, await sign(trusted));

    expect(result).toBe("panne");
  });

  it("kid connu mais signature d'une autre clé : jeton refusé", async () => {
    const { verify } = remoteVerifier([await jwk(trusted, "a")]);

    const result = await outcome(verify, await sign(attacker, "a"));

    expect(result).toBe("refusé");
  });
});
