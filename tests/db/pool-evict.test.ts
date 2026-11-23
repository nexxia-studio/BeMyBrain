// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createPool } from "@/db/pool";

// BRAIN-50, règle 3 de la spec : avant la nouvelle tentative, les connexions au repos du pool (gelées en même
// temps que la connexion morte, donc suspectes) sont retirées. evictIdle les ferme par l'API publique de
// pg-pool. Vrai pool sur la branche test, endpoint direct : une connexion = un backend Postgres, visible
// dans pg_stat_activity.

const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!backendUrl) {
  throw new Error(
    "tests/db/pool-evict.test.ts : DATABASE_TEST_AUTHENTICATED_URL requise (branche Neon test). Voir .env.example.",
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

const observer = new Pool({ connectionString: directBackendUrl, max: 1 });
observer.on("error", () => undefined);

afterAll(async () => {
  await observer.end();
});

let pool: ReturnType<typeof createPool>;

beforeEach(() => {
  // createPool journalise les erreurs de connexion : rien à afficher pendant ces tests.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  pool = createPool(directBackendUrl, "app_backend");
});

afterEach(async () => {
  await pool.end();
  vi.restoreAllMocks();
});

async function pidOf(client: PoolClient): Promise<number> {
  const { rows } = await safe(
    client.query<{ pid: number }>("select pg_backend_pid() as pid"),
  );
  return Number(rows[0]?.pid);
}

/** Emprunte `count` connexions distinctes, note leur pid, les rend au pool (au repos). */
async function warm(count: number): Promise<number[]> {
  const clients = await Promise.all(
    Array.from({ length: count }, () => safe(pool.connect())),
  );
  const pids = await Promise.all(clients.map(pidOf));
  for (const client of clients) client.release();
  return pids;
}

/** Backends encore vivants parmi `pids`, attendus jusqu'à leur disparition (fermeture asynchrone côté serveur). */
async function aliveAmong(pids: number[]): Promise<number[]> {
  let alive: number[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    const { rows } = await safe(
      observer.query<{ pid: number }>(
        "select pid from pg_stat_activity where pid = any($1::int[])",
        [pids],
      ),
    );
    alive = rows.map((row) => Number(row.pid));
    if (alive.length === 0) return alive;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return alive;
}

describe("createPool : evictIdle (BRAIN-50)", () => {
  it("ferme toutes les connexions au repos : le pool les oublie et leurs backends disparaissent", async () => {
    const pids = await warm(3);
    expect(new Set(pids).size).toBe(3);
    expect(pool.idleCount).toBe(3);

    await pool.evictIdle();

    expect(pool.totalCount).toBe(0);
    expect(pool.idleCount).toBe(0);
    expect(await aliveAmong(pids)).toEqual([]);
  }, 20_000);

  it("ne touche pas une connexion empruntée", async () => {
    const pids = await warm(3);
    const borrowed = await safe(pool.connect());
    const borrowedPid = await pidOf(borrowed);
    const idlePids = pids.filter((pid) => pid !== borrowedPid);

    try {
      await pool.evictIdle();

      expect(idlePids).toHaveLength(2);
      expect(pool.totalCount).toBe(1);
      expect(await pidOf(borrowed)).toBe(borrowedPid);
      expect(await aliveAmong(idlePids)).toEqual([]);
    } finally {
      borrowed.release();
    }
    expect(pool.idleCount).toBe(1);
  }, 20_000);

  it("le pool sert ensuite des connexions neuves", async () => {
    const oldPids = await warm(2);

    await pool.evictIdle();
    const client = await safe(pool.connect());
    const pid = await pidOf(client);
    client.release();

    expect(oldPids).not.toContain(pid);
    expect(pool.totalCount).toBe(1);
  }, 20_000);

  it("sans connexion au repos, n'ouvre aucune connexion", async () => {
    await pool.evictIdle();

    expect(pool.totalCount).toBe(0);
  }, 20_000);

  it("deux purges simultanées ferment les connexions au repos sans en ouvrir", async () => {
    const pids = await warm(3);

    await Promise.all([pool.evictIdle(), pool.evictIdle()]);

    expect(pool.totalCount).toBe(0);
    expect(await aliveAmong(pids)).toEqual([]);
  }, 20_000);

  it("retire aussi des connexions au repos déjà tuées côté serveur, sans exception non interceptée", async () => {
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => uncaught.push(error);
    process.on("uncaughtException", onUncaught);
    try {
      const pids = await warm(3);
      await safe(
        observer.query(
          "select pg_terminate_backend(pid) from unnest($1::int[]) as pid",
          [pids],
        ),
      );

      await pool.evictIdle();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(pool.totalCount).toBe(0);
      expect(uncaught).toEqual([]);
    } finally {
      process.off("uncaughtException", onUncaught);
    }
  }, 20_000);

  it("deux purges simultanées partagent la même passe", async () => {
    await warm(2);
    const connect = vi.spyOn(pool, "connect");

    const first = pool.evictIdle();
    const second = pool.evictIdle();
    await first;

    expect(second).toBe(first);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(pool.totalCount).toBe(0);
  }, 20_000);

  it("un emprunt de l'app lancé dans le même tick après la purge : purge finie, au plus une connexion ouverte, emprunt servi", async () => {
    const [oldPid] = await warm(1);
    let opened = 0;
    pool.on("connect", () => opened++);

    const purge = pool.evictIdle();
    const borrowing = safe(pool.connect());
    await purge;
    const client = await borrowing;

    try {
      expect(opened).toBeLessThanOrEqual(1);
      expect(await pidOf(client)).not.toBe(oldPid);
      expect(pool.totalCount).toBe(1);
    } finally {
      client.release();
    }
  }, 20_000);

  it("un emprunt de l'app lancé dans le même tick avant la purge : la purge lui laisse la connexion au repos et n'en ouvre aucune", async () => {
    const [oldPid] = await warm(1);
    let opened = 0;
    pool.on("connect", () => opened++);

    const borrowing = safe(pool.connect());
    await pool.evictIdle();
    const client = await borrowing;

    try {
      expect(opened).toBe(0);
      expect(await pidOf(client)).toBe(oldPid);
    } finally {
      client.release();
    }
  }, 20_000);

  it("pool plein, sa dernière connexion au repos promise à l'app : la purge n'attend aucune connexion occupée", async () => {
    const max = pool.options.max;
    await warm(max);
    const held = await Promise.all(
      Array.from({ length: max - 1 }, () => safe(pool.connect())),
    );
    const connect = vi.spyOn(pool, "connect");

    try {
      const borrowing = safe(pool.connect());
      const outcome = await Promise.race([
        pool.evictIdle().then(() => "finie"),
        new Promise((resolve) => setTimeout(resolve, 2_000, "bloquée")),
      ]);
      (await borrowing).release();

      expect(outcome).toBe("finie");
      expect(connect).toHaveBeenCalledTimes(1);
      expect(pool.totalCount).toBe(max);
    } finally {
      for (const client of held) client.release();
    }
  }, 30_000);

  it("une connexion au repos qui tombe pendant la purge : la purge garde la connexion neuve servie à sa place et s'arrête", async () => {
    const idle = await safe(pool.connect());
    const oldPid = await pidOf(idle);
    idle.release();
    let opened = 0;
    pool.on("connect", () => opened++);

    const purge = pool.evictIdle();
    // Erreur de la connexion au repos traitée avant que pg-pool ne serve l'emprunt de la purge : son
    // écouteur de repos la retire, l'emprunt est servi par une connexion neuve.
    idle.emit("error", new Error("coupure simulée"));
    await purge;

    expect(opened).toBe(1);
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    const client = await safe(pool.connect());
    try {
      expect(await pidOf(client)).not.toBe(oldPid);
    } finally {
      client.release();
    }
  }, 20_000);
});
