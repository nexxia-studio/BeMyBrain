// @vitest-environment node
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createAsUser } from "../factories/backend-tx";
import {
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../factories/core";

// Couleur des espaces (drizzle/0007) : contrainte, défaut, et droits d'app_backend (lecture seule).

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "tests/db/context-color.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";

const owner = new Pool({ connectionString: ownerUrl, max: 1 });
const backend = new Pool({ connectionString: backendUrl, max: 2 });
const f = newCoreFixture();
const asUser = createAsUser(backend);

beforeAll(() => insertCoreFixture(owner, f));

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), backend.end()]);
  }
});

/** Transaction propriétaire toujours annulée. */
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

describe("couleur des espaces (contexts.color)", () => {
  it("refuse une couleur hors de neutral, warm et indigo", async () => {
    const update = asOwner((db) =>
      db.query("update contexts set color = 'red' where id = $1", [f.contextA]),
    );

    await expect(update).rejects.toMatchObject({ code: CHECK_VIOLATION });
  });

  it("un espace créé sans couleur est neutral", async () => {
    const color = await asOwner(async (db) => {
      const result = await db.query(
        "insert into contexts (workspace_id, name, kind) values ($1, $2, 'pro') returning color",
        [f.workspaceA, `sans-couleur-${f.run}`],
      );
      return result.rows[0].color;
    });

    expect(color).toBe("neutral");
  });

  it("app_backend lit la couleur d'un espace de son workspace", async () => {
    const colors = await asUser(f.userA, async (db) => {
      const result = await db.query(
        "select color from contexts where id = $1",
        [f.contextA],
      );
      return result.rows.map((row) => row.color);
    });

    expect(colors).toEqual(["neutral"]);
  });

  it("app_backend ne peut pas modifier la couleur d'un espace", async () => {
    const update = asUser(f.userA, (db) =>
      db.query("update contexts set color = 'warm' where id = $1", [
        f.contextA,
      ]),
    );

    await expect(update).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("app_backend ne peut pas fixer la couleur à la création d'un espace", async () => {
    const insert = asUser(f.userA, (db) =>
      db.query(
        "insert into contexts (workspace_id, name, kind, color) values ($1, $2, 'pro', 'warm')",
        [f.workspaceA, `couleur-${f.run}`],
      ),
    );

    await expect(insert).rejects.toMatchObject({
      code: INSUFFICIENT_PRIVILEGE,
    });
  });
});
