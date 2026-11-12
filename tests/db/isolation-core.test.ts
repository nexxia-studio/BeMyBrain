// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
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
const UNIQUE_VIOLATION = "23505";

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();

beforeAll(() => insertCoreFixture(owner, f));

// Exécuté même si insertCoreFixture échoue à mi-chemin : suppression par les identifiants générés plus haut.
afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
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

/** Transaction propriétaire toujours annulée (vérifications de contraintes et de catalogue). */
async function asOwner<T>(run: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await owner.connect();
  try {
    await client.query("begin");
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

  it.each([
    ["DO NOTHING", "do nothing"],
    ["DO UPDATE", "do update set position = excluded.position"],
  ])(
    "INSERT … ON CONFLICT %s avec le workspace_id de A est refusé et ne révèle pas si le nom existe",
    async (_label, action) => {
      const attempt = (name: string) =>
        asUser(f.userB, (db) =>
          db.query(
            `insert into contexts (workspace_id, name, kind) values ($1, $2, 'pro')
             on conflict (workspace_id, name) ${action}`,
            [f.workspaceA, name],
          ),
        ).catch((error) => error.code);

      const codes = await Promise.all([
        attempt(`ctx-A-${f.run}`),
        attempt(`absent-${f.run}`),
      ]);

      expect(codes).toEqual([INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE]);
    },
  );

  it("UPDATE … RETURNING sur un contexte de A ne renvoie rien à l'utilisateur de B", async () => {
    const rows = await asUser(f.userB, async (db) => {
      const result = await db.query(
        "update contexts set position = 9 where id = $1 returning id, name, workspace_id",
        [f.contextA],
      );
      return result.rows;
    });

    expect(rows).toEqual([]);
  });

  it("DELETE … RETURNING sur un contexte de A ne renvoie rien à l'utilisateur de B", async () => {
    const rows = await asUser(f.userB, async (db) => {
      const result = await db.query(
        "delete from contexts where id = $1 returning id, name, workspace_id",
        [f.contextA],
      );
      return result.rows;
    });

    expect(rows).toEqual([]);
  });

  it("un utilisateur de B qui appelle app.is_workspace_member(A) obtient false", async () => {
    const answers = await asUser(f.userB, async (db) => {
      const result = await db.query(
        "select app.is_workspace_member($1) as a, app.is_workspace_member($2) as b",
        [f.workspaceA, f.workspaceB],
      );
      return result.rows[0];
    });

    expect(answers).toEqual({ a: false, b: true });
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
    const locales = await asUser(f.userA2, async (db) => {
      const read = () =>
        db
          .query("select locale from workspace_members where user_id = $1", [
            f.userA2,
          ])
          .then((result) => result.rows.map((row) => row.locale));
      const before = await read();
      await db.query(
        "update workspace_members set locale = 'fr' where user_id = $1",
        [f.userA2],
      );
      return { before, after: await read() };
    });

    expect(locales).toEqual({ before: ["en"], after: ["fr"] });
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

  it("modifier sa locale renseigne updated_at", async () => {
    const fresh = await asUser(f.userA2, async (db) => {
      const result = await db.query(
        `update workspace_members set locale = 'en' where user_id = $1
         returning updated_at is not null and updated_at >= now() - interval '1 minute' as fresh`,
        [f.userA2],
      );
      return result.rows.map((row) => row.fresh);
    });

    expect(fresh).toEqual([true]);
  });

  it("modifier un contexte renseigne updated_at", async () => {
    const fresh = await asUser(f.userA, async (db) => {
      const result = await db.query(
        `update contexts set position = 2 where id = $1
         returning updated_at is not null and updated_at >= now() - interval '1 minute' as fresh`,
        [f.contextA],
      );
      return result.rows.map((row) => row.fresh);
    });

    expect(fresh).toEqual([true]);
  });

  it("updated_at d'un workspace est renseigné à la modification (propriétaire)", async () => {
    const fresh = await asOwner(async (db) => {
      const result = await db.query(
        `update workspaces set name = name where id = $1
         returning updated_at is not null and updated_at >= now() - interval '1 minute' as fresh`,
        [f.workspaceA],
      );
      return result.rows.map((row) => row.fresh);
    });

    expect(fresh).toEqual([true]);
  });

  it.each([
    ["created_at", "now()"],
    ["updated_at", "now()"],
    ["id", "gen_random_uuid()"],
    ["workspace_id", "workspace_id"],
  ])(
    "un membre ne peut pas modifier la colonne %s d'un contexte de son workspace",
    async (column, value) => {
      const update = asUser(f.userA, (db) =>
        db.query(`update contexts set ${column} = ${value} where id = $1`, [
          f.contextA,
        ]),
      );

      await expect(update).rejects.toMatchObject({
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it.each(["id", "created_at", "updated_at"])(
    "un membre ne peut pas fixer la colonne %s à la création d'un contexte",
    async (column) => {
      const value = column === "id" ? "gen_random_uuid()" : "now()";

      const insert = asUser(f.userA, (db) =>
        db.query(
          `insert into contexts (workspace_id, name, kind, ${column}) values ($1, 'x', 'pro', ${value})`,
          [f.workspaceA],
        ),
      );

      await expect(insert).rejects.toMatchObject({
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it("deux contextes de même nom dans un workspace sont refusés", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, $2, 'pro')",
        [f.workspaceA, `ctx-A-${f.run}`],
      ),
    );

    await expect(insert).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it("un même nom de contexte est autorisé dans deux workspaces", async () => {
    const inserted = await asOwner(async (db) => {
      const result = await db.query(
        `insert into contexts (workspace_id, name, kind) values ($1, $3, 'pro'), ($2, $3, 'pro')`,
        [f.workspaceA, f.workspaceB, `commun-${f.run}`],
      );
      return result.rowCount;
    });

    expect(inserted).toBe(2);
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

describe("fonctions du schéma app", () => {
  it("aucune fonction du schéma app n'est exécutable par PUBLIC", async () => {
    const executableByPublic = await owner.query(`
      select p.oid::regprocedure::text as fn
      from pg_proc p
      where p.pronamespace = 'app'::regnamespace
        and (p.proacl is null
             or exists (select 1 from aclexplode(p.proacl) a
                        where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
    `);

    expect(executableByPublic.rows).toEqual([]);
  });

  it("une fonction créée plus tard par le rôle des migrations n'est pas exécutable par PUBLIC", async () => {
    const acl = await asOwner(async (db) => {
      await db.query(
        "create function app.probe_default_acl() returns int language sql as 'select 1'",
      );
      const result = await db.query(
        `select exists (
           select 1 from pg_proc p
           where p.oid = 'app.probe_default_acl()'::regprocedure
             and (p.proacl is null
                  or exists (select 1 from aclexplode(p.proacl) a
                             where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
         ) as public_execute`,
      );
      return result.rows[0].public_execute;
    });

    expect(acl).toBe(false);
  });

  it("les fonctions d'identité sont SECURITY DEFINER avec search_path figé", async () => {
    const functions = await owner.query(`
      select p.oid::regprocedure::text as fn, p.prosecdef as definer, p.proconfig as config
      from pg_proc p
      where p.oid in ('app.current_user_id()'::regprocedure, 'app.is_workspace_member(uuid)'::regprocedure)
      order by 1
    `);

    expect(functions.rows).toEqual([
      {
        fn: "app.current_user_id()",
        definer: true,
        config: ['search_path=""'],
      },
      {
        fn: "app.is_workspace_member(uuid)",
        definer: true,
        config: ['search_path=""'],
      },
    ]);
  });
});
