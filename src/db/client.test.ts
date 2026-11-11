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
  InvalidTokenError,
  type UserDb,
  type UserTx,
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

  it("injecte les claims vérifiés dans la transaction", async () => {
    const { db, tx } = fakeDb();
    const withUserDb = createWithUserDb({ verify, db });
    const token = await signToken(trusted.privateKey);
    const fn = vi.fn(async (received: UserTx) => {
      expect(tx.execute).toHaveBeenCalledTimes(1);
      return received;
    });

    const result = await withUserDb(token, fn);

    const query = new PgDialect().sqlToQuery(
      tx.execute.mock.calls[0][0] as SQL,
    );
    expect(query.sql).toBe("select set_config('request.jwt.claims', $1, true)");
    const claims = JSON.parse(query.params[0] as string);
    expect(claims).toMatchObject({ sub: USER_ID, iss: ISSUER });
    expect(result).toBe(tx);
  });
});
