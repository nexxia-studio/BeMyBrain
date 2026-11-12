// @vitest-environment node
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { describe, expect, it } from "vitest";

import { createWithUserDb, type VerifiedClaims } from "@/db/user-db";

const url = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!url) {
  throw new Error(
    "tests/db/app-backend.test.ts : DATABASE_TEST_AUTHENTICATED_URL manquante (rôle app_backend, branche Neon test). Voir .env.example.",
  );
}

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const claims: VerifiedClaims = { sub: USER_ID, role: "authenticated" };

// Un pool à une seule connexion par test : ce qui suit la transaction relit la même connexion.
async function withSingleConnection<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

function withUserDbOn(pool: Pool) {
  return createWithUserDb({
    verify: async () => claims,
    db: drizzle({ client: pool }),
  });
}

describe("withUserDb sur la branche de test", () => {
  it("exécute la transaction en app_backend avec les claims injectés", async () => {
    const row = await withSingleConnection((pool) =>
      withUserDbOn(pool)("jeton-déjà-vérifié", async (tx) => {
        const result = await tx.execute<{ who: string; sub: string }>(
          sql`select current_user as who, current_setting('request.jwt.claims', true)::json->>'sub' as sub`,
        );
        return result.rows[0];
      }),
    );

    expect(row).toEqual({ who: "app_backend", sub: USER_ID });
  });

  it("sur un backend Postgres neuf, l'identité est visible dès la première transaction", async () => {
    // Endpoint direct (sans -pooler) : une connexion neuve = un backend neuf, où pg_session_jwt
    // n'est pas encore chargée (voir withUserDb).
    const direct = new URL(url);
    direct.hostname = direct.hostname.replace(/^([^.]+)-pooler\./, "$1.");
    const pool = new Pool({ connectionString: direct.toString(), max: 1 });

    const uid = await withUserDbOn(pool)("jeton-déjà-vérifié", async (tx) => {
      const result = await tx.execute<{ uid: string | null }>(
        sql`select app.current_user_id()::text as uid`,
      );
      return result.rows[0].uid;
    }).finally(() => pool.end());

    expect(uid).toBe(USER_ID);
  });

  it("ne laisse aucun claim sur la connexion après la transaction", async () => {
    const after = await withSingleConnection(async (pool) => {
      await withUserDbOn(pool)("jeton-déjà-vérifié", (tx) =>
        tx.execute(sql`select 1`),
      );
      const result = await pool.query(
        "select coalesce(current_setting('request.jwt.claims', true), '') as claims",
      );
      return result.rows[0].claims;
    });

    expect(after).toBe("");
  });

  it("app_backend n'a ni BYPASSRLS, ni superuser, ni appartenance à neon_superuser, ni droit CREATE sur public et app", async () => {
    const privileges = await withSingleConnection(async (pool) => {
      const result = await pool.query(`
        select
          r.rolbypassrls as bypass_rls,
          r.rolsuper as superuser,
          exists (
            select 1 from pg_roles s
            where s.rolname = 'neon_superuser'
              and pg_has_role(current_user, s.oid, 'MEMBER')
          ) as neon_superuser,
          has_schema_privilege('public', 'CREATE') as create_public,
          coalesce((
            select has_schema_privilege(n.oid, 'CREATE')
            from pg_namespace n where n.nspname = 'app'
          ), false) as create_app
        from pg_roles r
        where r.rolname = current_user
      `);
      return result.rows[0];
    });

    expect(privileges).toEqual({
      bypass_rls: false,
      superuser: false,
      neon_superuser: false,
      create_public: false,
      create_app: false,
    });
  });

  it("app_backend ne possède aucune table, vue ni séquence", async () => {
    const owned = await withSingleConnection(async (pool) => {
      const result = await pool.query(
        "select count(*)::int as n from pg_class where relowner = (select oid from pg_roles where rolname = current_user)",
      );
      return result.rows[0].n;
    });

    expect(owned).toBe(0);
  });
});
