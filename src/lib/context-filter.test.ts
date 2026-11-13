// @vitest-environment node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const requireSessionToken = vi.hoisted(() => vi.fn());
const loadContexts = vi.hoisted(() => vi.fn());
const cookieValues = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/session", () => ({ requireSession, requireSessionToken }));
vi.mock("@/modules/core/contexts", () => ({ loadContexts }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
  }),
}));

// Build « react-server » : son `cache` mémoïse par requête (voir src/lib/session.test.ts, même harnais,
// mêmes limites : internes de React 19.3).
type ReactServer = typeof import("react") & {
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
    A: { getCacheForType: <T>(create: () => T) => T } | null;
  };
};
vi.mock("react", () => {
  const require = createRequire(import.meta.url);
  const dir = dirname(require.resolve("react/package.json"));
  return require(join(dir, "cjs/react.react-server.development.js"));
});

import { loadContextFilter } from "./context-filter";

const WORKSPACE_ID = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const PERSO = { id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", name: "Perso" };
const MAISON = { id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e", name: "Maison" };
const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

/** Simule une requête Next : un cache React neuf par requête. */
async function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  const react = (await import("react")) as unknown as ReactServer;
  const internals =
    react.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const caches = new Map<unknown, unknown>();
  internals.A = {
    getCacheForType<T>(create: () => T): T {
      if (!caches.has(create)) caches.set(create, create());
      return caches.get(create) as T;
    },
  };
  try {
    return await fn();
  } finally {
    internals.A = null;
  }
}

function contextsBySide(byside: Record<string, unknown[]>) {
  loadContexts.mockImplementation(
    async (_token: string, _workspace: string, side: string) =>
      byside[side] ?? [],
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieValues.clear();
  requireSession.mockResolvedValue({
    userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
    workspaceId: WORKSPACE_ID,
    workspaceName: "BeMyBrain",
  });
  requireSessionToken.mockResolvedValue("eyJ.jwt.signe");
  contextsBySide({ private: [PERSO], pro: [TRUSTUP, NEXXIA] });
});

describe("chargement du filtre d'espace", () => {
  it("lit les espaces du côté actif, avec le jeton et le workspace de la session", async () => {
    cookieValues.set("bmb_side", "pro");

    const filter = await inRequest(() => loadContextFilter());

    expect(loadContexts).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      WORKSPACE_ID,
      "pro",
    );
    expect(filter).toEqual({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [TRUSTUP.id, NEXXIA.id],
    });
  });

  it("ne propose aucun filtre quand le côté a moins de deux espaces", async () => {
    cookieValues.set("bmb_side", "private");

    const filter = await inRequest(() => loadContextFilter());

    expect(filter).toBeNull();
  });

  it("propose le filtre côté Privé dès qu'il a deux espaces", async () => {
    contextsBySide({ private: [PERSO, MAISON], pro: [] });
    cookieValues.set("bmb_contexts_private", MAISON.id);

    const filter = await inRequest(() => loadContextFilter());

    expect(filter).toEqual({
      side: "private",
      contexts: [PERSO, MAISON],
      selected: [MAISON.id],
    });
  });

  it("lit la sélection du seul côté actif", async () => {
    cookieValues.set("bmb_side", "pro");
    cookieValues.set("bmb_contexts_private", PERSO.id);
    cookieValues.set("bmb_contexts_pro", NEXXIA.id);

    const filter = await inRequest(() => loadContextFilter());

    expect(filter?.selected).toEqual([NEXXIA.id]);
  });

  it("revalide la sélection contre les espaces du workspace (étranger → tous)", async () => {
    cookieValues.set("bmb_side", "pro");
    cookieValues.set("bmb_contexts_pro", PERSO.id);

    const filter = await inRequest(() => loadContextFilter());

    expect(filter?.selected).toEqual([TRUSTUP.id, NEXXIA.id]);
  });

  it("ne lit les espaces qu'une fois par requête (barre latérale et en-tête de page)", async () => {
    cookieValues.set("bmb_side", "pro");

    await inRequest(async () => {
      await loadContextFilter();
      await loadContextFilter();
    });

    expect(loadContexts).toHaveBeenCalledTimes(1);
  });

  it("relit les espaces à chaque nouvelle requête", async () => {
    cookieValues.set("bmb_side", "pro");

    await inRequest(() => loadContextFilter());
    await inRequest(() => loadContextFilter());

    expect(loadContexts).toHaveBeenCalledTimes(2);
  });

  it("vérifie la session avant toute lecture", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(inRequest(() => loadContextFilter())).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(loadContexts).not.toHaveBeenCalled();
  });
});
