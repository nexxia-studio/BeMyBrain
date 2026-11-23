// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { DatabaseError, type VerifiedClaims } from "@/db/user-db";

// QA-4 : une connexion coupée pendant qu'une transaction l'emprunte ne doit pas tuer le processus.
// pg-pool (embarqué par @neondatabase/serverless) retire son écouteur d'erreur à l'emprunt : sans
// écouteur permanent, `client.emit("error")` devient une uncaughtException.
// Vrais pools du pilote sur la branche test ; la coupure est faite par le serveur (pg_terminate_backend
// depuis une seconde connexion du même rôle), ou par un événement d'erreur sur le vrai socket.

const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
const ownerUrl = process.env.DATABASE_TEST_URL;
if (!backendUrl || !ownerUrl) {
  throw new Error(
    "tests/db/pool-connection-loss.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const claims: VerifiedClaims = { sub: USER_ID, role: "authenticated" };

// Seul le vérificateur de jeton est remplacé (pas de JWKS en test) ; pool et pilote restent réels.
vi.mock("@/db/user-db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db/user-db")>()),
  createTokenVerifier: () => async () => claims,
}));

const killers = {
  backend: new Pool({ connectionString: backendUrl, max: 1 }),
  owner: new Pool({ connectionString: ownerUrl, max: 1 }),
};

afterAll(async () => {
  await Promise.all([killers.backend.end(), killers.owner.end()]);
});

let uncaught: unknown[];
const onUncaught = (error: unknown) => uncaught.push(error);
let consoleError: { mock: { calls: unknown[][] }; mockRestore: () => void };

beforeEach(() => {
  uncaught = [];
  process.on("uncaughtException", onUncaught);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  process.off("uncaughtException", onUncaught);
  consoleError.mockRestore();
  vi.unstubAllEnvs();
});

// Laisse passer les événements de fermeture du socket (close → end → error).
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

type Execute = (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;

/** Lecture longue empruntée, coupée côté serveur pendant qu'elle tourne. */
async function readCutByServer(execute: Execute, killer: Pool) {
  const { rows } = await execute(sql`select pg_backend_pid() as pid`);
  const pid = (rows[0] as { pid: number }).pid;
  const read = execute(sql`select pg_sleep(5)`);
  const outcome = read.then(
    () => "résolue",
    (error: unknown) => error,
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  const killed = await killer.query("select pg_terminate_backend($1) as ok", [
    pid,
  ]);
  expect(killed.rows[0]).toEqual({ ok: true });
  return { pid, error: await outcome };
}

function expectGenericLog(role: string) {
  const messages = consoleError.mock.calls.map((call: unknown[]) =>
    call.join(" "),
  );
  expect(messages).toContain(`Erreur sur une connexion du pool ${role}.`);
  for (const message of messages) {
    expect(message).not.toMatch(/postgres|neon\.tech|terminat|sleep/i);
  }
}

describe("connexion coupée pendant une lecture empruntée", () => {
  it("withUserDb (@/db/client) : la lecture échoue en DatabaseError, sans exception non interceptée, et l'appel suivant passe", async () => {
    vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
    vi.stubEnv(
      "NEON_AUTH_JWKS_URL",
      "https://auth.example.test/.well-known/jwks.json",
    );
    vi.stubEnv("NEON_AUTH_ISSUER", "https://auth.example.test");
    vi.stubEnv("NEON_AUTH_AUDIENCE", "https://auth.example.test");
    const { withUserDb } = await import("@/db/client");

    let cut: { pid: number; error: unknown } | undefined;
    const call = withUserDb("jeton", async (tx) => {
      cut = await readCutByServer(
        (query) => tx.execute(query),
        killers.backend,
      );
      throw cut.error;
    });

    await expect(call).rejects.toBeInstanceOf(DatabaseError);
    await settle();
    expect(uncaught).toEqual([]);
    expectGenericLog("app_backend");

    const next = await withUserDb("jeton", async (tx) => {
      const result = await tx.execute<{ pid: number; who: string }>(
        sql`select pg_backend_pid() as pid, current_user as who`,
      );
      return result.rows[0];
    });
    expect(next?.who).toBe("app_backend");
    expect(next?.pid).not.toBe(cut?.pid);
  });

  it("adminDb (@/db/admin) : la transaction rejette, sans exception non interceptée, et l'appel suivant passe", async () => {
    const { adminDb } = await import("@/db/admin");

    let cut: { pid: number; error: unknown } | undefined;
    const call = adminDb.transaction(async (tx) => {
      cut = await readCutByServer((query) => tx.execute(query), killers.owner);
      throw cut.error;
    });

    await expect(call).rejects.toBeInstanceOf(Error);
    await settle();
    expect(uncaught).toEqual([]);
    expectGenericLog("propriétaire");

    const next = await adminDb.execute<{ pid: number }>(
      sql`select pg_backend_pid() as pid`,
    );
    expect(next.rows[0]?.pid).not.toBe(cut?.pid);
  });

  it("createPool : une erreur du socket pendant une requête la fait rejeter, sans exception levée ni non interceptée", async () => {
    const { createPool } = await import("@/db/pool");
    const pool = createPool(backendUrl, "app_backend");
    const client: PoolClient = await pool.connect();
    try {
      const read = client.query("select pg_sleep(5)");
      const outcome = read.then(
        () => "résolue",
        (error: unknown) => error,
      );
      // Chemin de BEMYBRAIN-5 : reportStreamError → Client._handleErrorEvent → emit("error").
      const stream = (
        client as unknown as {
          connection: {
            stream: { emit: (event: string, error: Error) => void };
          };
        }
      ).connection.stream;

      expect(() =>
        stream.emit("error", new Error("socket coupé")),
      ).not.toThrow();
      expect(await outcome).toBeInstanceOf(Error);
      await settle();
      expect(uncaught).toEqual([]);
      expectGenericLog("app_backend");
    } finally {
      client.release(true);
      await pool.end();
    }
  });
});
