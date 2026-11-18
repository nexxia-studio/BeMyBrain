// @vitest-environment node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());
const resolveMembership = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
// Jeton refusé par withUserDb : classe factice reconnue par le prédicat du module (testé dans src/modules).
const RejectedToken = vi.hoisted(() => class RejectedToken extends Error {});

vi.mock("@/lib/auth/server", () => ({ getSessionToken, getSession }));
vi.mock("@/modules/core/membership", () => ({
  resolveMembership,
  isRejectedToken: (error: unknown) => error instanceof RejectedToken,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.current),
}));
vi.mock("./locale-cookie", () => ({ syncLocaleCookie }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

// Build « react-server » de React, celle que Next charge pour les Server Components : son `cache`
// mémoïse par requête (dispatcher posé par le rendu). La build cliente, chargée par défaut sous Vitest,
// ne mémoïse jamais.
// Fragile, assumé : `__SERVER_INTERNALS…` et `A.getCacheForType` sont internes à React (19.3). Gardé
// parce que c'est le seul moyen, sans rendu Flight complet, de tester le vrai `cache` de React (par requête,
// jamais partagé) plutôt qu'un double. Si une montée de React casse ce harnais, le réécrire, ne pas le retirer.
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

import {
  redirectIfRejectedToken,
  requireSession,
  requireSessionToken,
  requireSessionWithToken,
  syncSessionLocale,
} from "./session";

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
  requestHeaders.current = new Headers();
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

  it("renvoie userId et workspace, résolus depuis le JWT", async () => {
    const session = await inRequest(() => requireSession());

    expect(session).toEqual({
      userId: JWT_USER,
      workspaceId: WORKSPACE.id,
      workspaceName: WORKSPACE.name,
    });
    expect(resolveMembership).toHaveBeenCalledWith("eyJ.jwt.signe");
  });

  it("la session exposée aux pages ne contient pas le jeton, même sérialisée", async () => {
    const session = await inRequest(() => requireSession());

    expect(JSON.stringify(session)).not.toContain("eyJ.jwt.signe");
  });

  it("requireSessionToken renvoie le JWT vérifié, sans seconde vérification dans la même requête", async () => {
    const token = await inRequest(async () => {
      await requireSession();
      return requireSessionToken();
    });

    expect(token).toBe("eyJ.jwt.signe");
    expect(resolveMembership).toHaveBeenCalledTimes(1);
  });

  it("requireSessionWithToken renvoie la session et le JWT d'une seule vérification, même hors rendu (Server Action)", async () => {
    const resolved = await requireSessionWithToken();

    expect(resolved).toEqual({
      session: {
        userId: JWT_USER,
        workspaceId: WORKSPACE.id,
        workspaceName: WORKSPACE.name,
      },
      token: "eyJ.jwt.signe",
    });
    expect(getSessionToken).toHaveBeenCalledTimes(1);
    expect(resolveMembership).toHaveBeenCalledTimes(1);
  });

  it("requireSessionWithToken sans session redirige vers /login", async () => {
    getSessionToken.mockResolvedValue(null);

    const run = requireSessionWithToken();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(resolveMembership).not.toHaveBeenCalled();
  });

  it("requireSessionToken sans session redirige vers /login", async () => {
    getSessionToken.mockResolvedValue(null);

    const run = inRequest(() => requireSessionToken());

    await expect(run).rejects.toThrow("REDIRECT:/login");
  });

  it("le userId est celui du JWT vérifié, pas celui du cache de session", async () => {
    const session = await inRequest(() => requireSession());

    expect(session.userId).toBe(JWT_USER);
    expect(session.userId).not.toBe(CACHED_USER);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("ne recopie pas la langue (ni cookie écrit pendant le rendu) : seules la connexion et le changement de langue le font", async () => {
    await inRequest(() => requireSession());

    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });

  it("laisse remonter l'indisponibilité de l'auth au lieu de rediriger vers /login", async () => {
    const unavailable = new Error("Service d'authentification indisponible");
    getSessionToken.mockRejectedValue(unavailable);

    const run = inRequest(() => requireSession());

    await expect(run).rejects.toBe(unavailable);
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
});

describe("session expirée : renvoi vers /login (QA-1)", () => {
  const APP = { host: "bemybrain.test", "x-forwarded-proto": "https" };
  const ACTION = "408598b1af6ee1d3946827f5f62fd65e1f908928e8";

  function actionCall(referer: string) {
    requestHeaders.current = new Headers({
      ...APP,
      "next-action": ACTION,
      referer,
    });
  }

  it("depuis une action, renvoie vers /login avec la page d'origine en paramètre next", async () => {
    actionCall("https://bemybrain.test/settings?onglet=langue#haut");
    getSessionToken.mockResolvedValue(null);

    const run = requireSessionWithToken();

    await expect(run).rejects.toThrow("REDIRECT:/login?next=%2Fsettings");
  });

  it("depuis une action, un Referer d'une autre origine ne donne pas de next", async () => {
    actionCall("https://autre.test/settings");
    getSessionToken.mockResolvedValue(null);

    const run = requireSessionWithToken();

    await expect(run).rejects.toThrow(/^REDIRECT:\/login$/);
  });

  it("depuis une action, un Referer vers /login ne donne pas de next", async () => {
    actionCall("https://bemybrain.test/login");
    getSessionToken.mockResolvedValue(null);

    const run = requireSessionWithToken();

    await expect(run).rejects.toThrow(/^REDIRECT:\/login$/);
  });

  it("pendant le rendu d'une page (pas d'action), renvoie vers /login sans next : le Referer y est la page précédente", async () => {
    requestHeaders.current = new Headers({
      ...APP,
      referer: "https://bemybrain.test/settings",
    });
    getSessionToken.mockResolvedValue(null);

    const run = inRequest(() => requireSession());

    await expect(run).rejects.toThrow(/^REDIRECT:\/login$/);
  });

  it("un jeton refusé par la base (expiré, signature) renvoie vers /login au lieu de lever", async () => {
    actionCall("https://bemybrain.test/dashboard");
    resolveMembership.mockRejectedValue(new RejectedToken());

    const run = requireSessionWithToken();

    await expect(run).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
  });

  it("après la garde (jeton expiré entre-temps), un jeton refusé renvoie vers /login avec le même next", async () => {
    actionCall("https://bemybrain.test/settings");

    const run = redirectIfRejectedToken(new RejectedToken());

    await expect(run).rejects.toThrow("REDIRECT:/login?next=%2Fsettings");
  });

  it("après la garde, une autre erreur ne redirige pas", async () => {
    actionCall("https://bemybrain.test/settings");

    const run = redirectIfRejectedToken(new Error("Erreur de base de données"));

    await expect(run).resolves.toBeUndefined();
  });

  it("toute autre erreur de la base remonte telle quelle (page d'erreur, jamais /login)", async () => {
    const failure = new Error("Erreur de base de données");
    resolveMembership.mockRejectedValue(failure);

    const run = requireSessionWithToken();

    await expect(run).rejects.toBe(failure);
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
