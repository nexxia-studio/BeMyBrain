// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DomainError } from "@/lib/errors";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertContexts,
  insertCoreFixture,
  insertDualMember,
  newCoreFixture,
} from "../../../tests/factories/core";
import { CoreError } from "./errors";
import { setMemberLocale } from "./mutations";
import { getMemberLocale, getWorkspaceForUser, listContexts } from "./queries";

// Module core contre la branche Neon test : withUserDb réel en rôle app_backend (tests/factories/as-user.ts),
// fixture préparée par le propriétaire. Double verrou : filtre applicatif + RLS.

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/core/core.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  await insertDualMember(owner, f);
  // A : ctx-A (private, 0) de la fixture + Trustup et Nexxia (pro). B : ctx-B (pro, 0) + deux pro à égalité.
  await insertContexts(owner, f.workspaceA, [
    { name: "Nexxia", kind: "pro", position: 2 },
    { name: "Trustup", kind: "pro", position: 1 },
  ]);
  await insertContexts(owner, f.workspaceB, [
    { name: "Zeta", kind: "pro", position: 1 },
    { name: "Alpha", kind: "pro", position: 1 },
  ]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

describe("listContexts", () => {
  it("côté Pro renvoie Trustup et Nexxia, pas Privé", async () => {
    const contexts = await db.asUser(f.userA, (tx) =>
      listContexts(f.workspaceA, { side: "pro" }, tx),
    );

    expect(contexts.map((c) => [c.name, c.side])).toEqual([
      ["Trustup", "pro"],
      ["Nexxia", "pro"],
    ]);
  });

  it("côté Privé renvoie Privé seul", async () => {
    const contexts = await db.asUser(f.userA, (tx) =>
      listContexts(f.workspaceA, { side: "private" }, tx),
    );

    expect(contexts).toEqual([
      { id: f.contextA, name: `ctx-A-${f.run}`, side: "private", position: 0 },
    ]);
  });

  it("à position égale, trie par nom", async () => {
    const contexts = await db.asUser(f.userB, (tx) =>
      listContexts(f.workspaceB, { side: "pro" }, tx),
    );

    expect(contexts.map((c) => c.name)).toEqual([
      `ctx-B-${f.run}`,
      "Alpha",
      "Zeta",
    ]);
  });

  it("un workspaceId étranger renvoie une liste vide", async () => {
    const contexts = await db.asUser(f.userB, async (tx) => {
      const pro = await listContexts(f.workspaceA, { side: "pro" }, tx);
      const privateSide = await listContexts(
        f.workspaceA,
        { side: "private" },
        tx,
      );
      return [pro, privateSide];
    });

    expect(contexts).toEqual([[], []]);
  });

  it("un membre de A et de B ne voit dans listContexts(A) que les contextes de A", async () => {
    const contexts = await db.asUser(f.userAB, (tx) =>
      listContexts(f.workspaceA, { side: "pro" }, tx),
    );

    expect(contexts.map((c) => c.name)).toEqual(["Trustup", "Nexxia"]);
  });

  it("refuse un côté inconnu", async () => {
    const run = db.asUser(f.userA, (tx) =>
      listContexts(f.workspaceA, { side: "perso" as unknown as "pro" }, tx),
    );

    await expect(run).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("refuse un workspaceId qui n'est pas un uuid", async () => {
    const run = db.asUser(f.userA, (tx) =>
      listContexts("pas-un-uuid", { side: "pro" }, tx),
    );

    await expect(run).rejects.toBeInstanceOf(CoreError);
  });
});

describe("getWorkspaceForUser", () => {
  it("renvoie le workspace de l'utilisateur", async () => {
    const workspace = await db.asUser(f.userB, (tx) =>
      getWorkspaceForUser(f.userB, tx),
    );

    expect(workspace).toEqual({ id: f.workspaceB, name: `test-B-${f.run}` });
  });

  it("un membre ne résout pas le workspace d'un co-membre", async () => {
    const workspace = await db.asUser(f.userA2, (tx) =>
      getWorkspaceForUser(f.userA, tx),
    );

    expect(workspace).toBeNull();
  });

  it("renvoie null pour un utilisateur sans appartenance", async () => {
    const stranger = randomUUID();

    const workspace = await db.asUser(stranger, (tx) =>
      getWorkspaceForUser(stranger, tx),
    );

    expect(workspace).toBeNull();
  });

  it("ne révèle pas le workspace d'un utilisateur d'un autre workspace", async () => {
    const workspace = await db.asUser(f.userB, (tx) =>
      getWorkspaceForUser(f.userA, tx),
    );

    expect(workspace).toBeNull();
  });
});

describe("getMemberLocale", () => {
  it("renvoie fr par défaut", async () => {
    const locale = await db.asUser(f.userA, (tx) =>
      getMemberLocale(f.workspaceA, f.userA, tx),
    );

    expect(locale).toBe("fr");
  });

  it("getMemberLocale(B) renvoie sa locale de B, pas celle de A", async () => {
    const locales = await db.asUser(f.userAB, async (tx) => {
      const inA = await getMemberLocale(f.workspaceA, f.userAB, tx);
      const inB = await getMemberLocale(f.workspaceB, f.userAB, tx);
      return [inA, inB];
    });

    expect(locales).toEqual(["fr", "en"]);
  });

  it("renvoie null pour un membre d'un workspace étranger", async () => {
    const locale = await db.asUser(f.userB, (tx) =>
      getMemberLocale(f.workspaceA, f.userA, tx),
    );

    expect(locale).toBeNull();
  });
});

describe("setMemberLocale", () => {
  it("passe à en puis relit en", async () => {
    const applied = await db.asUser(f.userA2, (tx) =>
      setMemberLocale(f.workspaceA, f.userA2, "en", tx),
    );

    const reread = await db.asUser(f.userA2, (tx) =>
      getMemberLocale(f.workspaceA, f.userA2, tx),
    );
    expect([applied, reread]).toEqual(["en", "en"]);
  });

  it("refuse de", async () => {
    const run = db.asUser(f.userB, (tx) =>
      setMemberLocale(f.workspaceB, f.userB, "de" as unknown as "fr", tx),
    );

    await expect(run).rejects.toMatchObject({
      name: "CoreError",
      code: "invalid_input",
    });
  });

  it("sur un autre membre du même workspace ne touche rien et lève l'erreur métier", async () => {
    const run = db.asUser(f.userA2, (tx) =>
      setMemberLocale(f.workspaceA, f.userA, "en", tx),
    );

    await expect(run).rejects.toMatchObject({ code: "member_not_found" });
    const locale = await db.asUser(f.userA, (tx) =>
      getMemberLocale(f.workspaceA, f.userA, tx),
    );
    expect(locale).toBe("fr");
  });

  it("sur un autre workspace ne touche rien et lève l'erreur métier", async () => {
    const run = db.asUser(f.userB, (tx) =>
      setMemberLocale(f.workspaceA, f.userB, "en", tx),
    );

    await expect(run).rejects.toBeInstanceOf(CoreError);
    const locale = await db.asUser(f.userB, (tx) =>
      getMemberLocale(f.workspaceB, f.userB, tx),
    );
    expect(locale).toBe("fr");
  });

  it("l'erreur métier traverse withUserDb sans devenir DatabaseError", async () => {
    const error = await db
      .asUser(f.userB, (tx) => setMemberLocale(f.workspaceA, f.userA, "en", tx))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      name: "CoreError",
      code: "member_not_found",
    });
  });
});
