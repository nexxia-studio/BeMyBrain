// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createPool } from "@/db/pool";
import { createPooledDb } from "@/db/transaction-retry";
import { createWithUserDb, DatabaseError } from "@/db/user-db";

import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../factories/core";

// BRAIN-50, règle 1 de la spec : dès que la fonction métier a commencé, aucune nouvelle tentative. Une écriture
// dont la connexion tombe pendant fn n'est jamais rejouée : fn appelée une fois, transaction annulée, aucune
// ligne (ni en double), erreur remontée. Vrai pool, vrai withUserDb (seul le jeton est remplacé), branche test,
// endpoint direct (une connexion = un backend, tuable par pg_terminate_backend).

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/write-not-replayed.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

/** Endpoint direct (sans -pooler), comme tests/db/pool-dead-after-freeze.test.ts. */
function directUrl(url: string): string {
  const direct = new URL(url);
  direct.hostname = direct.hostname.replace(/^([^.]+)-pooler\./, "$1.");
  return direct.toString();
}
const directBackendUrl = directUrl(backendUrl);

/** Une erreur du pilote porte son client (hôte, mot de passe) : réécrite avec le seul SQLSTATE. */
function safe<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((error: { code?: unknown }) => {
    throw new Error(
      `Requête de test en échec (${typeof error?.code === "string" ? error.code : "sans SQLSTATE"})`,
    );
  });
}

const owner = createOwnerPool(ownerUrl);
owner.on("error", () => undefined);
const killer = new Pool({ connectionString: directBackendUrl, max: 1 });
killer.on("error", () => undefined);
const f = newCoreFixture();
const SLEEP_LIMIT_MS = 5_000;

beforeAll(async () => {
  await safe(insertCoreFixture(owner, f));
});

afterAll(async () => {
  await safe(deleteCoreFixture(owner, f));
  await Promise.all([owner.end(), killer.end()]);
});

let pool: ReturnType<typeof createPool>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // createPool journalise les erreurs de connexion : rien à afficher pendant ce test.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  pool = createPool(directBackendUrl, "app_backend");
});

afterEach(async () => {
  await pool.end();
  vi.restoreAllMocks();
});

/** Attend que le backend `pid` exécute pg_sleep ; échoue au-delà du plafond. */
async function waitForSleep(pid: number) {
  const deadline = Date.now() + SLEEP_LIMIT_MS;
  for (;;) {
    const { rows } = await safe(
      killer.query<{ n: number }>(
        "select count(*)::int as n from pg_stat_activity where pid = $1 and state = 'active' and query like '%pg_sleep%'",
        [pid],
      ),
    );
    if (rows[0]?.n === 1) return;
    if (Date.now() > deadline)
      throw new Error(`pg_sleep jamais vu après ${SLEEP_LIMIT_MS} ms.`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("écriture dont la connexion tombe pendant la fonction métier (BRAIN-50)", () => {
  it("n'est jamais rejouée : fn appelée une fois, aucune ligne écrite, DatabaseError", async () => {
    const withUserDb = createWithUserDb({
      verify: async () => ({ sub: f.userA, role: "authenticated" }),
      db: createPooledDb(pool),
      evictIdle: pool.evictIdle,
      poolName: "app_backend",
    });
    // Relevé hors de fn : un expect qui échouerait dans fn serait masqué en DatabaseError par withUserDb.
    let terminated: boolean | undefined;
    const title = `non-rejouée-${f.run}-${randomUUID().slice(0, 8)}`;
    const fn = vi.fn(
      async (tx: Parameters<Parameters<typeof withUserDb>[1]>[0]) => {
        await tx.execute(
          sql`insert into tasks (workspace_id, side, title, origin) values (${f.workspaceA}, 'private', ${title}, 'app')`,
        );
        const { rows } = await tx.execute<{ pid: number }>(
          sql`select pg_backend_pid() as pid`,
        );
        const pid = Number(rows[0]?.pid);
        // Requête Drizzle paresseuse : envoyée seulement au premier `then`. Issue relevée tout de suite, pour ne
        // laisser aucun rejet sans gestionnaire pendant la coupure.
        const sleeping = tx.execute(sql`select pg_sleep(10)`).then(
          () => undefined,
          (cut: unknown) => cut,
        );
        await waitForSleep(pid);
        const { rows: killed } = await safe(
          killer.query<{ ok: boolean }>(
            "select pg_terminate_backend($1) as ok",
            [pid],
          ),
        );
        terminated = killed[0]?.ok;
        const cut = await sleeping;
        if (cut) throw cut;
      },
    );

    const error = await withUserDb("jeton", fn).catch((e: unknown) => e);

    expect(terminated).toBe(true);
    // Booléen seulement : une erreur brute du pilote ne doit jamais être affichée par Vitest.
    expect(error instanceof DatabaseError).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    const { rows } = await safe(
      owner.query<{ n: number }>(
        "select count(*)::int as n from tasks where workspace_id = $1 and title = $2",
        [f.workspaceA, title],
      ),
    );
    expect(rows[0]?.n).toBe(0);
  }, 30_000);
});
