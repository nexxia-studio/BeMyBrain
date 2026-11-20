// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createTestUserDb } from "../../../tests/factories/as-user";
import {
  createOwnerPool,
  deleteCoreFixture,
  insertCoreFixture,
  newCoreFixture,
} from "../../../tests/factories/core";
import { insertTasks } from "../../../tests/factories/tasks";
import { TaskError } from "./errors";
import { listUpcomingTasks } from "./queries";
import { SIDE_TILE_LIMIT, sideTileItems } from "./view";

// Lecture des tuiles « To-do privée » / « To-do pro » contre la branche Neon test (withUserDb réel, rôle
// app_backend). Fixture propre à ce fichier : la fixture partagée de queries.test.ts n'est pas touchée.

vi.setConfig({ testTimeout: 20_000 });

const ownerUrl = process.env.DATABASE_TEST_URL;
const backendUrl = process.env.DATABASE_TEST_AUTHENTICATED_URL;
if (!ownerUrl || !backendUrl) {
  throw new Error(
    "src/modules/tasks/upcoming.test.ts : DATABASE_TEST_URL et DATABASE_TEST_AUTHENTICATED_URL requises (branche Neon test). Voir .env.example.",
  );
}

const owner = createOwnerPool(ownerUrl);
const db = createTestUserDb(backendUrl);
const f = newCoreFixture();

beforeAll(async () => {
  await insertCoreFixture(owner, f);
  // Une parente sans échéance, en tête par sa priorité dans « Sans échéance ».
  const [parent] = await insertTasks(owner, f.workspaceA, f.userA, [
    { side: "private", title: "Parente", priority: 1 },
  ]);
  await insertTasks(owner, f.workspaceA, f.userA, [
    // Six sous-tâches sans échéance, créées avant les tâches listées : elles passeraient devant elles par
    // l'ordre de création si la lecture ne les écartait pas.
    ...Array.from({ length: 6 }, (_, i) => ({
      side: "private" as const,
      title: `Sous-tâche ${i}`,
      parentId: parent,
      priority: 1,
    })),
    {
      side: "private",
      title: "Sous-tâche datée",
      parentId: parent,
      dueDate: "2026-11-30",
    },
    { side: "private", title: "Libre 1", priority: 2 },
    { side: "private", title: "Libre 2", priority: 3 },
    { side: "private", title: "Libre 3" },
    { side: "private", title: "Libre 4" },
    {
      side: "private",
      title: "Terminée",
      dueDate: "2026-11-01",
      statusCategory: "completed",
    },
    {
      side: "private",
      title: "Jetée",
      dueDate: "2026-11-01",
      deletedAt: "2026-11-18T10:00:00Z",
    },
    { side: "pro", title: "Pro du jour", dueDate: "2026-11-19" },
    {
      side: "private",
      title: "Dans l'espace",
      contextId: f.contextA,
      dueDate: "2026-12-01",
    },
  ]);
  await insertTasks(owner, f.workspaceB, f.userB, [
    { side: "private", title: "Tâche de B", dueDate: "2026-11-01" },
  ]);
});

afterAll(async () => {
  try {
    await deleteCoreFixture(owner, f);
  } finally {
    await Promise.all([owner.end(), db.end()]);
  }
});

const titlesOf = (tasks: { title: string }[]) => tasks.map((x) => x.title);

describe("listUpcomingTasks (tuiles par côté)", () => {
  it("5 lignes même avec des sous-tâches sans échéance : elles sont écartées par la lecture", async () => {
    const tasks = await db.asUser(f.userA, (tx) =>
      listUpcomingTasks(
        f.workspaceA,
        { side: "private", limit: SIDE_TILE_LIMIT },
        tx,
      ),
    );

    expect(titlesOf(tasks)).toEqual([
      "Sous-tâche datée",
      "Dans l'espace",
      "Parente",
      "Libre 1",
      "Libre 2",
    ]);
    expect(sideTileItems(tasks, "private")).toHaveLength(SIDE_TILE_LIMIT);
  });

  it("seulement les tâches ouvertes et actives du côté demandé, du workspace passé", async () => {
    const tasks = await db.asUser(f.userA, (tx) =>
      listUpcomingTasks(
        f.workspaceA,
        { side: "pro", limit: SIDE_TILE_LIMIT },
        tx,
      ),
    );

    expect(titlesOf(tasks)).toEqual(["Pro du jour"]);
  });

  it("filtre d'espace : seulement les tâches de cet espace", async () => {
    const tasks = await db.asUser(f.userA, (tx) =>
      listUpcomingTasks(
        f.workspaceA,
        { side: "private", contextId: f.contextA, limit: SIDE_TILE_LIMIT },
        tx,
      ),
    );

    expect(titlesOf(tasks)).toEqual(["Dans l'espace"]);
  });

  it("un utilisateur de A qui passe le workspace B ne lit rien (RLS)", async () => {
    const tasks = await db.asUser(f.userA, (tx) =>
      listUpcomingTasks(
        f.workspaceB,
        { side: "private", limit: SIDE_TILE_LIMIT },
        tx,
      ),
    );

    expect(tasks).toEqual([]);
  });

  it("côté inconnu → invalid_params", async () => {
    const error = await db
      .asUser(f.userA, (tx) =>
        listUpcomingTasks(
          f.workspaceA,
          { side: "both" as "private", limit: SIDE_TILE_LIMIT },
          tx,
        ),
      )
      .catch((e: unknown) => e);

    expect((error as TaskError).code).toBe("invalid_params");
  });
});
