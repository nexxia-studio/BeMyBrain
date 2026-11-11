// @vitest-environment node
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { afterAll, describe, expect, it } from "vitest";

import { createWithUserDb, type VerifiedClaims } from "@/db/user-db";

const url = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!url) {
  console.warn(
    "tests/db/app-backend.test.ts ignoré : DATABASE_TEST_AUTHENTICATED_URL absente (branche Neon de test).",
  );
}

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";

describe.runIf(Boolean(url))(
  "withUserDb sur la branche de test (ignoré sans DATABASE_TEST_AUTHENTICATED_URL)",
  () => {
    // Une seule connexion : le second test relit la connexion qui a porté la transaction.
    const pool = new Pool({ connectionString: url, max: 1 });
    afterAll(() => pool.end());

    it("exécute la transaction en app_backend avec les claims injectés", async () => {
      const claims: VerifiedClaims = { sub: USER_ID, role: "authenticated" };
      const withUserDb = createWithUserDb({
        verify: async () => claims,
        db: drizzle({ client: pool }),
      });

      const row = await withUserDb("jeton-déjà-vérifié", async (tx) => {
        const result = await tx.execute<{ who: string; sub: string }>(
          sql`select current_user as who, current_setting('request.jwt.claims', true)::json->>'sub' as sub`,
        );
        return result.rows[0];
      });

      expect(row).toEqual({ who: "app_backend", sub: USER_ID });
    });

    it("ne laisse aucun claim sur la connexion après la transaction", async () => {
      const result = await pool.query(
        "select coalesce(current_setting('request.jwt.claims', true), '') as claims",
      );

      expect(result.rows[0].claims).toBe("");
    });
  },
);
