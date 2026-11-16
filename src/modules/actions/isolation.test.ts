// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import { invokeAction, prepareAction, registry } from "./registry";

// Isolation du registre (constitution 5) contre la branche Neon test : withUserDb réel en rôle app_backend,
// actions du registre lancées pour un utilisateur avec le workspace d'un autre. Rien n'est lu ni écrit.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/actions/isolation.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

function run(
  userId: string,
  workspaceId: string,
  name: string,
  params: unknown,
) {
  const prepared = prepareAction(registry, name, params, "web");
  return db.asUser(userId, (tx, identity) =>
    invokeAction(prepared, { workspaceId, userId: identity.userId, tx }),
  );
}

async function localeOf(workspaceId: string, userId: string) {
  const { rows } = await owner.query<{ locale: string }>(
    "select locale from workspace_members where workspace_id = $1 and user_id = $2",
    [workspaceId, userId],
  );
  return rows[0]?.locale;
}

describe("registre d'actions : isolation entre deux workspaces", () => {
  it("core.listContexts lancé par B sur le workspace de A ne renvoie rien", async () => {
    const result = await run(f.userB, f.workspaceA, "core.listContexts", {
      side: "private",
    });

    expect(result).toEqual([]);
  });

  it("core.listContexts lancé par A sur son workspace renvoie ses contextes", async () => {
    const result = await run(f.userA, f.workspaceA, "core.listContexts", {
      side: "private",
    });

    expect(result).toEqual([
      expect.objectContaining({ id: f.contextA, side: "private" }),
    ]);
  });

  it("core.setLocale lancé par B sur le workspace de A n'écrit rien", async () => {
    const attempt = run(f.userB, f.workspaceA, "core.setLocale", {
      locale: "en",
    });

    await expect(attempt).rejects.toMatchObject({ code: "member_not_found" });
    expect(await localeOf(f.workspaceA, f.userA)).toBe("fr");
    expect(await localeOf(f.workspaceA, f.userA2)).toBe("en");
  });
});
