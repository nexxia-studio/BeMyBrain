// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DatabaseError as DriverDatabaseError } from "@neondatabase/serverless";
import type { PoolClient } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError } from "@/lib/errors";

import { redirectError } from "../../tests/factories/next-control";

import {
  createPooledDb,
  EVICT_TIMEOUT_MS,
  runTransaction,
  type TransactionDb,
} from "./transaction-retry";
import { IdentityNotAppliedError, InvalidTokenError } from "./user-db";

// BRAIN-50, solution C : une seule nouvelle tentative, seulement si la connexion tombe AVANT la fonction
// métier (prise de connexion, BEGIN, mise en place). Faux db : `transaction` rejoue le scénario de chaque essai.

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

const lost = () => new Error("Connection terminated unexpectedly");
const lostWrapped = () =>
  new DrizzleQueryError("select app.current_user_id()", [], lost());
function serverError(code: string) {
  const error = new DriverDatabaseError("message du serveur", 0, "error");
  error.code = code;
  return error;
}
class TestDomainError extends DomainError {
  override name = "TestDomainError";
}

type Tx = { id: number };
/** Où l'essai échoue : au BEGIN (avant le rappel), ou rien (le rappel tourne). */
type Attempt = { failAtBegin?: unknown };

function fakeDb(attempts: Attempt[]) {
  let index = 0;
  const transaction = vi.fn(
    async (callback: (tx: Tx) => Promise<unknown>): Promise<unknown> => {
      const attempt = attempts[index] ?? {};
      const tx = { id: index };
      index += 1;
      if (attempt.failAtBegin !== undefined) throw attempt.failAtBegin;
      return callback(tx);
    },
  );
  return { transaction };
}

let warn: ReturnType<typeof vi.spyOn>;
let evictIdle: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  evictIdle = vi.fn(async () => undefined);
  captureException.mockClear();
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

/** Faux db non générique : le type générique de TransactionDb ne se prête pas à vi.fn. */
type FakeDb = {
  transaction: (callback: (tx: Tx) => Promise<unknown>) => Promise<unknown>;
};
const deps = (db: FakeDb) => ({
  db: db as TransactionDb<Tx>,
  evictIdle,
  poolName: "app_backend",
});

describe("runTransaction : connexion perdue avant la fonction métier", () => {
  it("rejoue une fois une perte au BEGIN, après purge du pool", async () => {
    const db = fakeDb([{ failAtBegin: lost() }, {}]);
    const fn = vi.fn(async (tx: Tx) => `lu sur ${tx.id}`);

    const result = await runTransaction(deps(db), async () => undefined, fn);

    expect(result).toBe("lu sur 1");
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(evictIdle).toHaveBeenCalledTimes(1);
    expect(evictIdle.mock.invocationCallOrder[0]).toBeLessThan(
      db.transaction.mock.invocationCallOrder[1]!,
    );
  });

  it("rejoue une perte pendant la mise en place, et rappelle la mise en place sur la nouvelle transaction", async () => {
    const db = fakeDb([{}, {}]);
    const setup = vi
      .fn<(tx: Tx) => Promise<void>>()
      .mockRejectedValueOnce(lostWrapped())
      .mockResolvedValueOnce(undefined);
    const fn = vi.fn(async (tx: Tx) => tx.id);

    const result = await runTransaction(deps(db), setup, fn);

    expect(result).toBe(1);
    expect(setup.mock.calls.map(([tx]) => tx.id)).toEqual([0, 1]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejoue une perte signalée par un SQLSTATE de connexion (57P01)", async () => {
    const db = fakeDb([{ failAtBegin: serverError("57P01") }, {}]);

    const result = await runTransaction(
      deps(db),
      async () => undefined,
      async () => "ok",
    );

    expect(result).toBe("ok");
    expect(db.transaction).toHaveBeenCalledTimes(2);
  });

  it("deux pertes de suite : l'erreur du second essai remonte, sans troisième essai", async () => {
    const second = lost();
    const db = fakeDb([{ failAtBegin: lost() }, { failAtBegin: second }]);
    const fn = vi.fn(async () => "lu");

    const error = await runTransaction(
      deps(db),
      async () => undefined,
      fn,
    ).catch((e: unknown) => e);

    expect(error).toBe(second);
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(fn).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("runTransaction : la fonction métier a commencé", () => {
  it("une perte dans la fonction métier n'est jamais rejouée : fn appelée une fois, erreur remontée telle quelle", async () => {
    const db = fakeDb([{}, {}]);
    const thrown = lost();
    const fn = vi.fn(async () => {
      throw thrown;
    });

    const error = await runTransaction(
      deps(db),
      async () => undefined,
      fn,
    ).catch((e: unknown) => e);

    expect(error).toBe(thrown);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(evictIdle).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("une perte au COMMIT, après la fonction métier, n'est pas rejouée", async () => {
    const thrown = lost();
    const transaction = vi.fn(
      async (callback: (tx: Tx) => Promise<unknown>): Promise<unknown> => {
        await callback({ id: 0 });
        throw thrown;
      },
    );
    const fn = vi.fn(async () => "écrit");

    const error = await runTransaction(
      deps({ transaction }),
      async () => undefined,
      fn,
    ).catch((e: unknown) => e);

    expect(error).toBe(thrown);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

describe("runTransaction : erreurs qui ne sont pas des pertes de connexion", () => {
  it.each([
    ["refus RLS (42501)", () => serverError("42501")],
    ["doublon (23505)", () => serverError("23505")],
    ["table absente (42P01)", () => serverError("42P01")],
    ["jeton refusé", () => new InvalidTokenError("ERR_JWT_EXPIRED")],
    ["identité non appliquée", () => new IdentityNotAppliedError()],
    ["erreur métier", () => new TestDomainError("probe_failed")],
    ["erreur de contrôle de Next", () => redirectError("/login")],
    ["erreur quelconque", () => new Error("autre chose")],
  ])("%s au BEGIN : pas rejouée", async (_label, make) => {
    const thrown = make();
    const db = fakeDb([{ failAtBegin: thrown }, {}]);

    const error = await runTransaction(
      deps(db),
      async () => undefined,
      async () => "lu",
    ).catch((e: unknown) => e);

    expect(error).toBe(thrown);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(evictIdle).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("une identité non appliquée pendant la mise en place n'est pas rejouée", async () => {
    const db = fakeDb([{}, {}]);
    const thrown = new IdentityNotAppliedError();

    const error = await runTransaction(
      deps(db),
      async () => {
        throw thrown;
      },
      async () => "lu",
    ).catch((e: unknown) => e);

    expect(error).toBe(thrown);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("runTransaction : trace", () => {
  it("écrit une seule ligne, avec le pool et l'étape « connexion », sans message ni code du pilote", async () => {
    const db = fakeDb([{ failAtBegin: serverError("57P01") }, {}]);

    await runTransaction(
      deps(db),
      async () => undefined,
      async () => "lu",
    );

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([
      "Nouvelle tentative sur le pool app_backend : connexion perdue (étape connexion).",
    ]);
  });

  it("nomme l'étape « identité » quand la perte survient pendant la mise en place", async () => {
    const db = fakeDb([{}, {}]);
    const setup = vi
      .fn<(tx: Tx) => Promise<void>>()
      .mockRejectedValueOnce(lost())
      .mockResolvedValueOnce(undefined);

    await runTransaction(deps(db), setup, async () => "lu");

    expect(warn.mock.calls).toEqual([
      [
        "Nouvelle tentative sur le pool app_backend : connexion perdue (étape identité).",
      ],
    ]);
  });

  it("n'envoie rien à Sentry, et le fichier n'importe pas Sentry", async () => {
    const db = fakeDb([{ failAtBegin: lost() }, { failAtBegin: lost() }]);

    await runTransaction(
      deps(db),
      async () => undefined,
      async () => "lu",
    ).catch(() => undefined);

    expect(captureException).not.toHaveBeenCalled();
    const source = readFileSync(
      join(import.meta.dirname, "transaction-retry.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/sentry/i);
  });
});

describe("runTransaction : purge bornée", () => {
  it("une purge qui rejette n'empêche pas la nouvelle tentative et ne masque rien", async () => {
    evictIdle.mockRejectedValueOnce(new Error("purge en échec"));
    const db = fakeDb([{ failAtBegin: lost() }, {}]);

    const result = await runTransaction(
      deps(db),
      async () => undefined,
      async () => "lu",
    );

    expect(result).toBe("lu");
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("une purge qui ne se termine jamais : nouvelle tentative après le délai borné", async () => {
    vi.useFakeTimers();
    evictIdle.mockReturnValueOnce(new Promise<void>(() => undefined));
    const db = fakeDb([{ failAtBegin: lost() }, {}]);

    const pending = runTransaction(
      deps(db),
      async () => undefined,
      async () => "lu",
    );
    await vi.advanceTimersByTimeAsync(EVICT_TIMEOUT_MS - 1);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toBe("lu");
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(EVICT_TIMEOUT_MS).toBe(500);
  });
});

describe("createPooledDb : la connexion est toujours rendue au pool", () => {
  function fakePool(query: PoolClient["query"]) {
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const connect = vi.fn(async () => client);
    return { pool: { connect }, release, connect };
  }

  it("rend la connexion saine après un COMMIT", async () => {
    const query = vi.fn(async () => ({ rows: [], fields: [] }));
    const { pool, release } = fakePool(query as unknown as PoolClient["query"]);
    const db = createPooledDb(pool);

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
      return "lu";
    });

    expect(result).toBe("lu");
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("perte au BEGIN : la connexion est rendue et retirée du pool (Drizzle ne la rend pas dans ce cas)", async () => {
    const query = vi.fn(async () => {
      throw lost();
    });
    const { pool, release } = fakePool(query as unknown as PoolClient["query"]);
    const db = createPooledDb(pool);
    const callback = vi.fn(async () => "lu");

    const error = await db.transaction(callback).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(callback).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(true);
  });

  it("perte dans la transaction : la connexion est retirée du pool", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], fields: [] })
      .mockRejectedValue(lost());
    const { pool, release } = fakePool(query as unknown as PoolClient["query"]);
    const db = createPooledDb(pool);

    await db
      .transaction(async (tx) => tx.execute(sql`select 1`))
      .catch(() => undefined);

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(true);
  });

  it("erreur SQL dans la transaction : la connexion, saine, retourne au repos", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], fields: [] })
      .mockRejectedValueOnce(serverError("42501"))
      .mockResolvedValue({ rows: [], fields: [] });
    const { pool, release } = fakePool(query as unknown as PoolClient["query"]);
    const db = createPooledDb(pool);

    await db
      .transaction(async (tx) => tx.execute(sql`select 1`))
      .catch(() => undefined);

    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(undefined);
  });

  it("échec de la prise de connexion : rien à rendre, l'erreur remonte", async () => {
    const thrown = lost();
    const connect = vi.fn(async (): Promise<PoolClient> => {
      throw thrown;
    });
    const db = createPooledDb({ connect });

    const error = await db
      .transaction(async () => "lu")
      .catch((e: unknown) => e);

    expect(error).toBe(thrown);
  });
});
