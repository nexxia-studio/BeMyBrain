// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError } from "@/lib/errors";

import {
  createWithUserDb,
  DatabaseError,
  IdentityNotAppliedError,
  type UserDb,
  type UserTx,
} from "./user-db";

// BRAIN-50 : withUserDb rejoue une seule fois une transaction dont la connexion tombe avant fn, en reposant
// l'identité sur la nouvelle connexion. Faux db : chaque appel à `transaction` est un essai, avec sa propre tx.

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const lost = () => new Error("Connection terminated unexpectedly");

type Attempt = {
  /** Erreur levée avant le rappel (prise de connexion, BEGIN). */
  failAtBegin?: unknown;
  /** Erreur levée par la n-ième requête de la mise en place (0 = amorce, 1 = set_config, 2 = contrôle). */
  failAtQuery?: { index: number; error: unknown };
  /** Réponse du contrôle d'identité (défaut : true). */
  applied?: boolean | null;
};

function fakeDb(attempts: Attempt[]) {
  const txs: { execute: ReturnType<typeof vi.fn> }[] = [];
  const transaction = vi.fn(
    async (callback: (tx: UserTx) => Promise<unknown>) => {
      const attempt = attempts[txs.length] ?? {};
      let calls = 0;
      const tx = {
        execute: vi.fn(async () => {
          const index = calls++;
          if (attempt.failAtQuery?.index === index)
            throw attempt.failAtQuery.error;
          return { rows: [{ applied: attempt.applied ?? true }] };
        }),
      };
      txs.push(tx);
      if (attempt.failAtBegin !== undefined) throw attempt.failAtBegin;
      return callback(tx as unknown as UserTx);
    },
  );
  return { db: { transaction } as unknown as UserDb, transaction, txs };
}

const verify = vi.fn(async () => ({
  sub: USER_ID,
  role: "authenticated",
  exp: 2_000_000_000,
}));
let evictIdle: ReturnType<typeof vi.fn<() => Promise<void>>>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  verify.mockClear();
  evictIdle = vi.fn(async () => undefined);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
});

function build(db: UserDb) {
  return createWithUserDb({ verify, db, evictIdle, poolName: "app_backend" });
}

const identityQueries = (tx: { execute: ReturnType<typeof vi.fn> }) =>
  tx.execute.mock.calls.slice(0, 3).map(([query]) => {
    const { sql, params } = new PgDialect().sqlToQuery(query as SQL);
    return { sql, params };
  });

const EXPECTED_IDENTITY = [
  { sql: "select app.current_user_id()", params: [] },
  {
    sql: "select set_config('request.jwt.claims', $1, true)",
    params: [
      JSON.stringify({
        sub: USER_ID,
        role: "authenticated",
        exp: 2_000_000_000,
      }),
    ],
  },
  {
    sql: "select app.current_user_id() = $1::uuid as applied",
    params: [USER_ID],
  },
];

describe("withUserDb : nouvelle tentative (BRAIN-50)", () => {
  it("connexion perdue au BEGIN : rejouée, l'identité est posée sur la nouvelle transaction avant fn", async () => {
    const { db, txs } = fakeDb([{ failAtBegin: lost() }, {}]);
    const fn = vi.fn(async (tx: UserTx) => tx);

    const usedTx = await build(db)("jeton", fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(usedTx).toBe(txs[1]);
    expect(identityQueries(txs[1]!)).toEqual(EXPECTED_IDENTITY);
    expect(evictIdle).toHaveBeenCalledTimes(1);
  });

  it.each([
    [0, "amorce de pg_session_jwt"],
    [1, "set_config"],
    [2, "contrôle de l'identité"],
  ])(
    "connexion perdue pendant la pose de l'identité (%s, %s) : identité reposée en entier sur la nouvelle connexion",
    async (index) => {
      const { db, txs } = fakeDb([
        { failAtQuery: { index, error: lost() } },
        {},
      ]);
      const fn = vi.fn(async (tx: UserTx) => tx);

      const usedTx = await build(db)("jeton", fn);

      expect(usedTx).toBe(txs[1]);
      expect(identityQueries(txs[1]!)).toEqual(EXPECTED_IDENTITY);
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );

  it("le jeton n'est vérifié qu'une fois : la nouvelle tentative reprend les claims déjà vérifiés", async () => {
    const { db } = fakeDb([{ failAtBegin: lost() }, {}]);

    await build(db)("jeton", async () => "lu");

    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("connexion perdue dans fn : pas rejouée, fn appelée une fois, DatabaseError", async () => {
    const { db, transaction } = fakeDb([{}, {}]);
    const fn = vi.fn(async () => {
      throw Object.assign(lost(), { code: "57P01" });
    });

    const error = await build(db)("jeton", fn).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).code).toBe("57P01");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("deux pertes de suite : DatabaseError, sans troisième essai", async () => {
    const { db, transaction } = fakeDb([
      { failAtBegin: lost() },
      { failAtBegin: Object.assign(lost(), { code: "08006" }) },
    ]);

    const error = await build(db)("jeton", async () => "lu").catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).code).toBe("08006");
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("identité non appliquée : relancée telle quelle, sans nouvelle tentative", async () => {
    const { db, transaction } = fakeDb([{ applied: false }, {}]);
    const fn = vi.fn(async () => "lu");

    const error = await build(db)("jeton", fn).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IdentityNotAppliedError);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("erreur métier au second essai : traverse telle quelle", async () => {
    const { db } = fakeDb([{ failAtBegin: lost() }, {}]);
    class ProbeError extends DomainError {}
    const thrown = new ProbeError("probe_failed");

    const error = await build(db)("jeton", async () => {
      throw thrown;
    }).catch((e: unknown) => e);

    expect(error).toBe(thrown);
  });

  it.each([
    ["redirect", () => redirect("/no-workspace")],
    ["notFound", () => notFound()],
  ])(
    "erreur de contrôle de Next (%s) au second essai : relancée telle quelle",
    async (_label, control) => {
      const { db } = fakeDb([{ failAtBegin: lost() }, {}]);
      let thrown: unknown;

      const error = await build(db)("jeton", async () => {
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
});
