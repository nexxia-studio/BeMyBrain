// @vitest-environment node
import { randomUUID } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, describe, expect, it } from "vitest";

import { parseSeedEnv, seedFailureMessage, seedWorkspace } from "./seed";

// Seed contre la branche Neon test, connexion propriétaire (comme le vrai seed).
// Chaque test utilise des propriétaires aléatoires ; tout ce qui leur appartient est supprimé à la fin.

const ownerUrl = process.env.DATABASE_TEST_URL;
if (!ownerUrl) {
  throw new Error(
    "scripts/seed.test.ts : DATABASE_TEST_URL requise (branche Neon test). Voir .env.example.",
  );
}

const pool = new Pool({ connectionString: ownerUrl, max: 3 });
const db = drizzle({ client: pool });
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

    const first = await seedWorkspace(db, { ownerUserId: owner });
    const second = await seedWorkspace(db, { ownerUserId: owner });

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
    const { workspaceId } = await seedWorkspace(db, { ownerUserId: owner });
    await pool.query(
      "update contexts set name = 'Trustup SA', position = 5 where workspace_id = $1 and name = 'Trustup'",
      [workspaceId],
    );

    await seedWorkspace(db, { ownerUserId: owner });

    expect(await contextsOf(workspaceId)).toEqual([
      { name: "Privé", kind: "private", position: 0 },
      { name: "Nexxia", kind: "pro", position: 2 },
      { name: "Trustup SA", kind: "pro", position: 5 },
    ]);
  });

  it("deux seeds simultanés pour le même propriétaire produisent un seul workspace", async () => {
    const owner = newOwner();

    const [a, b] = await Promise.all([
      seedWorkspace(db, { ownerUserId: owner }),
      seedWorkspace(db, { ownerUserId: owner }),
    ]);

    expect(b.workspaceId).toBe(a.workspaceId);
    expect(await workspacesOf(owner)).toHaveLength(1);
    expect(await contextsOf(a.workspaceId)).toHaveLength(3);
  });

  it("un second utilisateur owner obtient son propre workspace", async () => {
    const ownerA = newOwner();
    const ownerB = newOwner();

    const a = await seedWorkspace(db, { ownerUserId: ownerA });
    const b = await seedWorkspace(db, { ownerUserId: ownerB });

    expect(b.workspaceId).not.toBe(a.workspaceId);
    expect(await workspacesOf(ownerB)).toEqual([
      { id: b.workspaceId, name: "BeMyBrain", role: "owner", locale: "fr" },
    ]);
    expect(await contextsOf(b.workspaceId)).toHaveLength(3);
  });
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
