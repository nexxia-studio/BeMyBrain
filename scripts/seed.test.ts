// @vitest-environment node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { createPool } from "@/db/pool";
import { createPooledDb, runTransaction } from "@/db/transaction-retry";

import {
  parseSeedEnv,
  seedFailureMessage,
  seedWorkspace,
  type SeedTransaction,
} from "./seed";

// Seed contre la branche Neon test, connexion propriétaire (comme le vrai seed).
// Chaque test utilise des propriétaires aléatoires ; tout ce qui leur appartient est supprimé à la fin.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "scripts/seed.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

// Même mécanisme que withAdminTx (src/db/admin.ts), sur le pool propriétaire de la branche test.
const pool = createPool(ownerUrl, "test");
const transaction: SeedTransaction = (fn) =>
  runTransaction(
    { db: createPooledDb(pool), evictIdle: pool.evictIdle, poolName: "test" },
    async () => undefined,
    fn,
  );
const owners: string[] = [];

function newOwner(): string {
  const id = randomUUID();
  owners.push(id);
  return id;
}

// Suppression par propriétaire : couvre aussi un seed interrompu à mi-chemin.
afterAll(async () => {
  try {
    const { rows } = await pool.query(
      "select distinct workspace_id from workspace_members where user_id = any($1)",
      [owners],
    );
    const ids = rows.map((row) => row.workspace_id);
    await pool.query("delete from contexts where workspace_id = any($1)", [
      ids,
    ]);
    await pool.query(
      "delete from workspace_members where workspace_id = any($1)",
      [ids],
    );
    await pool.query("delete from workspaces where id = any($1)", [ids]);
  } finally {
    await pool.end();
  }
});

async function workspacesOf(userId: string) {
  const { rows } = await pool.query(
    `select w.id, w.name, m.role, m.locale
       from workspace_members m join workspaces w on w.id = m.workspace_id
      where m.user_id = $1`,
    [userId],
  );
  return rows;
}

async function contextsOf(workspaceId: string) {
  const { rows } = await pool.query(
    "select name, kind, position from contexts where workspace_id = $1 order by position, name",
    [workspaceId],
  );
  return rows;
}

describe("seed rejouable", () => {
  it("lancé deux fois, le seed produit un workspace et trois contextes", async () => {
    const owner = newOwner();

    const first = await seedWorkspace(transaction, { ownerUserId: owner });
    const second = await seedWorkspace(transaction, { ownerUserId: owner });

    expect(second.workspaceId).toBe(first.workspaceId);
    expect(await workspacesOf(owner)).toEqual([
      { id: first.workspaceId, name: "BeMyBrain", role: "owner", locale: "fr" },
    ]);
    expect(await contextsOf(first.workspaceId)).toEqual([
      { name: "Privé", kind: "private", position: 0 },
      { name: "Trustup", kind: "pro", position: 1 },
      { name: "Nexxia", kind: "pro", position: 2 },
    ]);
  });

  it("ne recrée pas un contexte renommé ni ne remet en place un contexte réordonné", async () => {
    const owner = newOwner();
    const { workspaceId } = await seedWorkspace(transaction, {
      ownerUserId: owner,
    });
    await pool.query(
      "update contexts set name = 'Trustup SA', position = 5 where workspace_id = $1 and name = 'Trustup'",
      [workspaceId],
    );

    await seedWorkspace(transaction, { ownerUserId: owner });

    expect(await contextsOf(workspaceId)).toEqual([
      { name: "Privé", kind: "private", position: 0 },
      { name: "Nexxia", kind: "pro", position: 2 },
      { name: "Trustup SA", kind: "pro", position: 5 },
    ]);
  });

  it("donne aux espaces par défaut leur couleur : Privé neutral, Trustup warm, Nexxia indigo", async () => {
    const owner = newOwner();

    const { workspaceId } = await seedWorkspace(transaction, {
      ownerUserId: owner,
    });

    const { rows } = await pool.query(
      "select name, color from contexts where workspace_id = $1 order by position",
      [workspaceId],
    );
    expect(rows).toEqual([
      { name: "Privé", color: "neutral" },
      { name: "Trustup", color: "warm" },
      { name: "Nexxia", color: "indigo" },
    ]);
  });

  it("deux seeds simultanés pour le même propriétaire produisent un seul workspace", async () => {
    const owner = newOwner();

    const [a, b] = await Promise.all([
      seedWorkspace(transaction, { ownerUserId: owner }),
      seedWorkspace(transaction, { ownerUserId: owner }),
    ]);

    expect(b.workspaceId).toBe(a.workspaceId);
    expect(await workspacesOf(owner)).toHaveLength(1);
    expect(await contextsOf(a.workspaceId)).toHaveLength(3);
  });

  it("un second utilisateur owner obtient son propre workspace", async () => {
    const ownerA = newOwner();
    const ownerB = newOwner();

    const a = await seedWorkspace(transaction, { ownerUserId: ownerA });
    const b = await seedWorkspace(transaction, { ownerUserId: ownerB });

    expect(b.workspaceId).not.toBe(a.workspaceId);
    expect(await workspacesOf(ownerB)).toEqual([
      { id: b.workspaceId, name: "BeMyBrain", role: "owner", locale: "fr" },
    ]);
    expect(await contextsOf(b.workspaceId)).toHaveLength(3);
  });
});

const ROOT = join(import.meta.dirname, "..");
const CHILD = join(ROOT, "tests/factories/seed-child.mts");
// tsx à froid, plus le réveil possible du compute Neon de la branche test.
const TSX_TIMEOUT_MS = 60_000;

/** Lance un script sous tsx, comme `pnpm db:seed`, sur la branche test ; rend son stdout (stderr ignoré : messages du pilote). */
function runUnderTsx(
  args: string[],
  extraEnv: Record<string, string> = {},
): Promise<{ code: number | null; stdout: string }> {
  // Garde-fou du seed en local (NEON_PRODUCTION_HOST) ou plateforme de confiance (CI) : recopiés s'ils existent.
  const guard = Object.fromEntries(
    ["NEON_PRODUCTION_HOST", "GITHUB_ACTIONS", "VERCEL"].flatMap((name) =>
      process.env[name] ? [[name, process.env[name]]] : [],
    ),
  );
  const proc = spawn(process.execPath, ["--import", "tsx", ...args], {
    cwd: ROOT,
    // DATABASE_URL et DATABASE_AUTHENTICATED_URL posées sur la branche test : `.env`, chargé par le seed,
    // ne remplace jamais une variable déjà définie.
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      DATABASE_URL: ownerUrl,
      DATABASE_AUTHENTICATED_URL: backendUrl,
      ...guard,
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "ignore"],
  });
  let stdout = "";
  proc.stdout!.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  return new Promise((resolve) =>
    proc.once("close", (code) => resolve({ code, stdout })),
  );
}

async function runChild(mode: string, owner: string) {
  const { code, stdout } = await runUnderTsx([CHILD, mode, owner]);
  return { code, result: JSON.parse(stdout.trim()) as Record<string, unknown> };
}

// Sous tsx, selon le point d'entrée (.mts ESM ou .ts CommonJS), le Pool de createPool et celui que voit Drizzle
// peuvent être deux exemplaires : `drizzle({ client: pool }).transaction` n'ouvre alors aucune vraie transaction
// (témoin ci-dessous). withAdminTx (createPooledDb) en tient une dans tous les cas.
describe("seed sous tsx, comme pnpm db:seed", () => {
  it(
    "via withAdminTx, une erreur après les insertions annule tout : aucune ligne ne reste",
    async () => {
      const owner = newOwner();

      const { code, result } = await runChild("rollback", owner);

      expect({ code, result }).toEqual({
        code: 0,
        result: { outcome: "annulée" },
      });
      expect(await workspacesOf(owner)).toEqual([]);
    },
    TSX_TIMEOUT_MS,
  );

  it(
    "via withAdminTx, deux lectures simultanées d'une transaction passent par une seule connexion",
    async () => {
      const { code, result } = await runChild("backends", "");

      expect({ code, result }).toEqual({ code: 0, result: { backends: 1 } });
    },
    TSX_TIMEOUT_MS,
  );

  it(
    "témoin : drizzle({ client: pool }) sur createPool, depuis un point d'entrée ESM, répartit une même « transaction » sur deux connexions — si ce test échoue, drizzle et le pilote partagent désormais le même Pool sous tsx",
    async () => {
      const { code, result } = await runChild("naive-backends", "");

      expect({ code, result }).toEqual({ code: 0, result: { backends: 2 } });
    },
    TSX_TIMEOUT_MS,
  );

  it(
    "via withAdminTx, deux seeds simultanés pour le même propriétaire ne créent qu'un workspace",
    async () => {
      const owner = newOwner();

      const { code, result } = await runChild("concurrent", owner);

      expect(code).toBe(0);
      expect(
        (result.created as boolean[]).toSorted((a, b) => Number(a) - Number(b)),
      ).toEqual([false, true]);
      const rows = await workspacesOf(owner);
      expect(rows).toHaveLength(1);
      expect(await contextsOf(rows[0].id)).toHaveLength(3);
    },
    TSX_TIMEOUT_MS,
  );

  it(
    "la commande du seed (scripts/seed.ts) crée le workspace sur la branche visée, puis ne refait rien",
    async () => {
      const owner = newOwner();
      const env = { SEED_OWNER_USER_ID: owner };

      const first = await runUnderTsx(["scripts/seed.ts"], env);
      const second = await runUnderTsx(["scripts/seed.ts"], env);

      expect(first).toEqual({
        code: 0,
        stdout: "Seed : workspace et contextes créés.\n",
      });
      expect(second).toEqual({
        code: 0,
        stdout: "Seed : workspace déjà présent, rien à faire.\n",
      });
      expect(await workspacesOf(owner)).toHaveLength(1);
    },
    TSX_TIMEOUT_MS * 2,
  );
});

describe("variables du seed", () => {
  const local = {
    DATABASE_URL:
      "postgresql://owner:secret@ep-dev-123.eu-central-1.aws.neon.tech/neondb",
    NEON_PRODUCTION_HOST: "ep-prod-456.eu-central-1.aws.neon.tech",
  };

  it("refuse un SEED_OWNER_USER_ID qui n'est pas un uuid", () => {
    const check = () =>
      parseSeedEnv({ ...local, SEED_OWNER_USER_ID: "not-a-uuid" });

    expect(check).toThrow(/SEED_OWNER_USER_ID/);
    expect(check).not.toThrow(/not-a-uuid/);
  });

  it("refuse un SEED_OWNER_USER_ID absent", () => {
    const check = () => parseSeedEnv(local);

    expect(check).toThrow(/SEED_OWNER_USER_ID/);
  });

  it("refuse de viser la production en local", () => {
    const check = () =>
      parseSeedEnv({
        ...local,
        DATABASE_URL:
          "postgresql://owner:secret@ep-prod-456-pooler.eu-central-1.aws.neon.tech/neondb",
        SEED_OWNER_USER_ID: randomUUID(),
      });

    expect(check).toThrow(/NEON_PRODUCTION_HOST/);
    expect(check).not.toThrow(/ep-prod|secret/);
  });

  it("refuse MIGRATION_TARGET : le seed vise toujours DATABASE_URL", () => {
    const check = () =>
      parseSeedEnv({
        ...local,
        MIGRATION_TARGET: "test",
        SEED_OWNER_USER_ID: randomUUID(),
      });

    expect(check).toThrow(/MIGRATION_TARGET/);
  });

  it("accepte un uuid sur une branche autre que la production", () => {
    const id = randomUUID();

    expect(parseSeedEnv({ ...local, SEED_OWNER_USER_ID: id })).toEqual({
      ownerUserId: id,
    });
  });
});

describe("message d'erreur du seed", () => {
  it("ajoute le SQLSTATE d'une erreur de la base, sans son message", () => {
    const error = Object.assign(new Error("connexion à ep-secret refusée"), {
      code: "23505",
    });

    const message = seedFailureMessage(error);

    expect(message).toMatch(/23505/);
    expect(message).not.toMatch(/ep-secret/);
  });

  it("lit le SQLSTATE dans la cause d'une erreur enveloppée par drizzle", () => {
    const error = new Error("Failed query", {
      cause: Object.assign(new Error("détail"), { code: "42501" }),
    });

    expect(seedFailureMessage(error)).toMatch(/42501/);
  });

  it("n'ajoute rien qui ne soit pas un SQLSTATE de 5 caractères", () => {
    const error = Object.assign(new Error("hôte introuvable"), {
      code: "ENOTFOUND ep-secret",
    });

    const message = seedFailureMessage(error);

    expect(message).toBe(
      "Seed en échec : erreur de la base, transaction annulée.",
    );
  });
});
