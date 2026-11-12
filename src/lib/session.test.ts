// @vitest-environment node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const resolveMembership = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSessionToken, getSession }));
vi.mock("@/modules/core/membership", () => ({ resolveMembership }));
vi.mock("./locale-cookie", () => ({ syncLocaleCookie }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Build « react-server » de React, celle que Next charge pour les Server Components : son `cache`
// mémoïse par requête (dispatcher posé par le rendu). La build cliente, chargée par défaut sous Vitest,
// ne mémoïse jamais.
type CacheDispatcher = {
  getCacheForType: <T>(create: () => T) => T;
};
type ReactServer = typeof import("react") & {
  __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
    A: CacheDispatcher | null;
  };
};
vi.mock("react", () => {
  const require = createRequire(import.meta.url);
  const dir = dirname(require.resolve("react/package.json"));
  return require(join(dir, "cjs/react.react-server.development.js"));
});

import { requireSession, syncSessionLocale } from "./session";

const JWT_USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const CACHED_USER = "5b1e2c3d-4f50-4a61-8b72-9c83d94ea0fb";
const WORKSPACE = {
  id: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  name: "BeMyBrain",
};

/** Simule une requête Next : un cache React neuf, comme le rendu Flight en crée un par requête. */
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

beforeEach(() => {
  getSessionToken.mockReset().mockResolvedValue("eyJ.jwt.signe");
  getSession.mockReset().mockResolvedValue({ user: { id: CACHED_USER } });
  resolveMembership.mockReset().mockResolvedValue({
    userId: JWT_USER,
    workspace: WORKSPACE,
    locale: "en",
  });
  syncLocaleCookie.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireSession", () => {
  it("sans session, lève une redirection vers /login", async () => {
    getSessionToken.mockResolvedValue(null);

    const run = inRequest(() => requireSession());

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(resolveMembership).not.toHaveBeenCalled();
  });

  it("un utilisateur sans appartenance est envoyé vers la page sans workspace", async () => {
    resolveMembership.mockResolvedValue({
      userId: JWT_USER,
      workspace: null,
      locale: null,
    });

    const run = inRequest(() => requireSession());

    await expect(run).rejects.toThrow("REDIRECT:/no-workspace");
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });

  it("renvoie userId, workspace et le JWT (jamais le jeton opaque)", async () => {
    const session = await inRequest(() => requireSession());

    expect(session).toEqual({
      userId: JWT_USER,
      workspaceId: WORKSPACE.id,
      workspaceName: WORKSPACE.name,
      token: "eyJ.jwt.signe",
    });
    expect(resolveMembership).toHaveBeenCalledWith("eyJ.jwt.signe");
  });

  it("le userId est celui du JWT vérifié, pas celui du cache de session", async () => {
    const session = await inRequest(() => requireSession());

    expect(session.userId).toBe(JWT_USER);
    expect(session.userId).not.toBe(CACHED_USER);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("recopie la locale enregistrée du membre dans le cookie de langue", async () => {
    await inRequest(() => requireSession());

    expect(syncLocaleCookie).toHaveBeenCalledWith("en");
  });

  it("requireSession n'appelle withUserDb qu'une fois par requête", async () => {
    await inRequest(async () => {
      await requireSession();
      await requireSession();
    });

    expect(resolveMembership).toHaveBeenCalledTimes(1);
  });

  it("ne partage jamais la session mémoïsée entre deux requêtes", async () => {
    const other = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";
    await inRequest(() => requireSession());
    resolveMembership.mockResolvedValue({
      userId: other,
      workspace: WORKSPACE,
      locale: "fr",
    });

    const second = await inRequest(() => requireSession());

    expect(second.userId).toBe(other);
    expect(resolveMembership).toHaveBeenCalledTimes(2);
  });

  it("une Server Action non publique appelée sans session est refusée", async () => {
    getSessionToken.mockResolvedValue(null);
    const effect = vi.fn();
    // Forme imposée à toute action non publique (test tests/lint/server-actions.test.ts).
    async function protectedAction() {
      const session = await requireSession();
      effect(session.workspaceId);
    }

    // Une action s'exécute hors rendu : pas de cache React, appel direct.
    const run = protectedAction();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(effect).not.toHaveBeenCalled();
  });
});

describe("syncSessionLocale (après connexion)", () => {
  it("après connexion, le cookie NEXT_LOCALE reçoit la locale enregistrée", async () => {
    await syncSessionLocale();

    expect(resolveMembership).toHaveBeenCalledWith("eyJ.jwt.signe");
    expect(syncLocaleCookie).toHaveBeenCalledWith("en");
  });

  it("sans JWT, ne lit rien et ne redirige pas", async () => {
    getSessionToken.mockResolvedValue(null);

    await syncSessionLocale();

    expect(resolveMembership).not.toHaveBeenCalled();
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });

  it("une panne de lecture ne bloque pas la connexion et ne journalise aucune donnée", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resolveMembership.mockRejectedValue(new Error(`panne ${JWT_USER}`));

    const run = syncSessionLocale();

    await expect(run).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain(JWT_USER);
    warn.mockRestore();
  });
});
