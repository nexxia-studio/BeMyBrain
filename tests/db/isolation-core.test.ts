// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createCoreFixture,
  deleteCoreFixture,
  type CoreFixture,
} from "../factories/core";

// Isolation au niveau de la base (ADR-002) : assertions en app_backend, claims posés à la main,
// AUCUN filtre applicatif. Les clauses `id = any(...)` ne font que restreindre aux lignes de ce run.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/isolation-core.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const INSUFFICIENT_PRIVILEGE = "42501"; // GRANT absent ou WITH CHECK de la RLS
const CHECK_VIOLATION = "23514";

let owner: Pool;
let backend: Pool;
let f: CoreFixture;

beforeAll(async () => {
  owner = new Pool({ connectionString: ownerUrl, max: 1 });
  backend = new Pool({ connectionString: backendUrl, max: 2 });
  f = await createCoreFixture(owner);
});

afterAll(async () => {
  if (f) await deleteCoreFixture(owner, f);
  await Promise.all([owner?.end(), backend?.end()]);
});

/**
 * Transaction app_backend avec les claims de `sub` (aucun si null), toujours annulée :
 * les écritures réussies d'un test ne fuient pas dans les suivants.
 */
async function asUser<T>(
  sub: string | null,
  run: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await backend.connect();
  try {
    await client.query("begin");
    // Comme withUserDb : charger pg_session_jwt avant set_config, sinon un backend neuf perd les claims.
    await client.query("select app.current_user_id()");
    if (sub) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role: "authenticated" }),
      ]);
    }
    return await run(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

async function count(
  db: PoolClient,
  table: "workspaces" | "workspace_members" | "contexts",
  column: "id" | "workspace_id",
  ids: string[],
): Promise<number> {
  const result = await db.query(
    `select count(*)::int as n from ${table} where ${column} = any($1)`,
    [ids],
  );
  return result.rows[0].n;
}

describe("isolation des tables workspaces, workspace_members, contexts (RLS, app_backend)", () => {
  it("l'utilisateur du workspace B ne lit aucune ligne du workspace A", async () => {
    const seen = await asUser(f.userB, async (db) => ({
      workspaces: await count(db, "workspaces", "id", [f.workspaceA]),
      members: await count(db, "workspace_members", "workspace_id", [
        f.workspaceA,
      ]),
      contexts: await count(db, "contexts", "workspace_id", [f.workspaceA]),
    }));

    expect(seen).toEqual({ workspaces: 0, members: 0, contexts: 0 });
  });

  it("l'utilisateur du workspace B lit son propre workspace, ses membres et ses contextes", async () => {
    const seen = await asUser(f.userB, async (db) => ({
      workspaces: await count(db, "workspaces", "id", [
        f.workspaceA,
        f.workspaceB,
      ]),
      members: await count(db, "workspace_members", "workspace_id", [
        f.workspaceA,
        f.workspaceB,
      ]),
      contexts: await count(db, "contexts", "workspace_id", [
        f.workspaceA,
        f.workspaceB,
      ]),
    }));

    expect(seen).toEqual({ workspaces: 1, members: 1, contexts: 1 });
  });

  it("un membre lit les autres membres de son workspace", async () => {
    const members = await asUser(f.userA2, (db) =>
      count(db, "workspace_members", "workspace_id", [f.workspaceA]),
    );

    expect(members).toBe(2);
  });

  it("sans claims, ne lit rien", async () => {
    const all = [f.workspaceA, f.workspaceB];

    const seen = await asUser(null, async (db) => ({
      workspaces: await count(db, "workspaces", "id", all),
      members: await count(db, "workspace_members", "workspace_id", all),
      contexts: await count(db, "contexts", "workspace_id", all),
    }));

    expect(seen).toEqual({ workspaces: 0, members: 0, contexts: 0 });
  });

  it("l'utilisateur de B ne peut pas insérer de contexte chez A", async () => {
    const insert = asUser(f.userB, (db) =>
      db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, 'intrus', 'pro')",
        [f.workspaceA],
      ),
    );

    await expect(insert).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("l'utilisateur de B ne peut pas modifier un contexte de A", async () => {
    const updated = await asUser(f.userB, async (db) => {
      const result = await db.query(
        "update contexts set name = 'piraté' where id = $1",
        [f.contextA],
      );
      return result.rowCount;
    });

    expect(updated).toBe(0);
  });

  it("l'utilisateur de B ne peut pas supprimer un contexte de A", async () => {
    const deleted = await asUser(f.userB, async (db) => {
      const result = await db.query("delete from contexts where id = $1", [
        f.contextA,
      ]);
      return result.rowCount;
    });

    expect(deleted).toBe(0);
  });

  it("l'utilisateur de B ne peut pas déplacer un contexte de B vers A", async () => {
    const move = asUser(f.userB, (db) =>
      db.query("update contexts set workspace_id = $1 where id = $2", [
        f.workspaceA,
        f.contextB,
      ]),
    );

    await expect(move).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
  });

  it("un membre crée, modifie et supprime un contexte de son workspace", async () => {
    const rowCounts = await asUser(f.userA2, async (db) => {
      const inserted = await db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, 'nouveau', 'pro') returning id",
        [f.workspaceA],
      );
      const id = inserted.rows[0].id;
      const updated = await db.query(
        "update contexts set name = 'renommé', position = 1 where id = $1",
        [id],
      );
      const deleted = await db.query("delete from contexts where id = $1", [
        id,
      ]);
      return [inserted.rowCount, updated.rowCount, deleted.rowCount];
    });

    expect(rowCounts).toEqual([1, 1, 1]);
  });

  it("un contexte d'un type hors private/pro est refusé", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, 'x', 'perso')",
        [f.workspaceA],
      ),
    );

    await expect(insert).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("l'utilisateur de B ne peut pas modifier la locale d'un membre de A", async () => {
    const updated = await asUser(f.userB, async (db) => {
      const result = await db.query(
        "update workspace_members set locale = 'en' where user_id = $1",
        [f.userA],
      );
      return result.rowCount;
    });

    expect(updated).toBe(0);
  });

  it("ne peut pas modifier la locale d'un autre membre de son propre workspace", async () => {
    const updated = await asUser(f.userA2, async (db) => {
      const result = await db.query(
        "update workspace_members set locale = 'en' where user_id = $1",
        [f.userA],
      );
      return result.rowCount;
    });

    expect(updated).toBe(0);
  });

  it("peut modifier sa propre locale", async () => {
    const locale = await asUser(f.userA2, async (db) => {
      const result = await db.query(
        "update workspace_members set locale = 'en' where user_id = $1 returning locale",
        [f.userA2],
      );
      return result.rows.map((row) => row.locale);
    });

    expect(locale).toEqual(["en"]);
  });

  it("ne peut pas modifier son propre rôle", async () => {
    const promote = asUser(f.userA2, (db) =>
      db.query(
        "update workspace_members set role = 'owner' where user_id = $1",
        [f.userA2],
      ),
    );

    await expect(promote).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("ne peut pas rattacher sa propre appartenance à un autre workspace", async () => {
    const move = asUser(f.userA2, (db) =>
      db.query(
        "update workspace_members set workspace_id = $1 where user_id = $2",
        [f.workspaceB, f.userA2],
      ),
    );

    await expect(move).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
  });

  it("une locale hors fr/en est refusée", async () => {
    const update = asUser(f.userA2, (db) =>
      db.query(
        "update workspace_members set locale = 'de' where user_id = $1",
        [f.userA2],
      ),
    );

    await expect(update).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("ne peut pas créer de workspace", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query("insert into workspaces (name) values ('pirate')"),
    );

    await expect(insert).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("ne peut pas se créer d'appartenance, même dans un workspace dont il est membre", async () => {
    const insert = asUser(f.userB, (db) =>
      db.query(
        "insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner'), ($3, $2, 'owner')",
        [f.workspaceB, f.userB, f.workspaceA],
      ),
    );

    await expect(insert).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("ne peut pas supprimer son workspace", async () => {
    const remove = asUser(f.userA, (db) =>
      db.query("delete from workspaces where id = $1", [f.workspaceA]),
    );

    await expect(remove).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("ne peut pas supprimer une appartenance, même en owner", async () => {
    const remove = asUser(f.userA, (db) =>
      db.query("delete from workspace_members where user_id = $1", [f.userA2]),
    );

    await expect(remove).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("la RLS est active sur les trois tables, sans policy FOR ALL ni USING (true), et seulement pour app_backend", async () => {
    const catalog = await owner.query(`
      select
        (select count(*)::int from pg_tables
          where schemaname = 'public'
            and tablename in ('workspaces', 'workspace_members', 'contexts')
            and rowsecurity) as rls_tables,
        (select count(*)::int from pg_policies
          where schemaname = 'public'
            and tablename in ('workspaces', 'workspace_members', 'contexts')
            and (cmd = 'ALL' or qual = 'true' or with_check = 'true'
                 or roles <> '{app_backend}')) as bad_policies
    `);

    expect(catalog.rows[0]).toEqual({ rls_tables: 3, bad_policies: 0 });
  });
});
