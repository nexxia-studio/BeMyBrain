// @vitest-environment node
import {
  MutableRequestCookiesAdapter,
  RequestCookiesAdapter,
} from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { extractNeonAuthCookies } from "@neon/auth/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: null as unknown as {
    set: (...args: never[]) => unknown;
    getAll: () => { name: string; value: string }[];
    get: (name: string) => { value: string } | undefined;
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => request.cookies,
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

import { AuthUnavailableError, getSession, getSessionToken } from "./server";

const BASE_URL = "https://auth.example.test/neondb/auth";
const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

const sessionBody = {
  session: {
    id: "s1",
    token: "opaque",
    userId: USER_ID,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-11-12T00:00:00.000Z",
    updatedAt: "2026-11-12T00:00:00.000Z",
  },
  user: {
    id: USER_ID,
    email: "a@example.test",
    createdAt: "2026-11-12T00:00:00.000Z",
    updatedAt: "2026-11-12T00:00:00.000Z",
  },
};

// Réponse de Neon Auth qui renouvelle le cookie de session (comportement de Better Auth).
function sessionResponse() {
  return Response.json(sessionBody, {
    headers: {
      "set-cookie": `${SESSION_COOKIE}=opaque; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/** Magasin de cookies d'un rendu de Server Component : le vrai, scellé par Next. */
function renderCookieStore() {
  return RequestCookiesAdapter.seal(new RequestCookies(request.headers));
}

/** Magasin de cookies d'une action (écriture espionnée), lu depuis les cookies de la requête. */
function actionCookieStore() {
  const cookies = new RequestCookies(request.headers);
  return {
    getAll: () => cookies.getAll(),
    get: (name: string) => cookies.get(name),
    set: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubEnv("NEON_AUTH_BASE_URL", BASE_URL);
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "s".repeat(32));
  request.headers = new Headers({ cookie: `${SESSION_COOKIE}=opaque` });
  request.cookies = actionCookieStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("session serveur", () => {
  it("renvoie l'identifiant de l'utilisateur connecté", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sessionResponse()),
    );

    const session = await getSession();

    expect(session).toEqual({ user: { id: USER_ID } });
  });

  it("ne plante pas le rendu quand Neon Auth renvoie un Set-Cookie pendant un Server Component", async () => {
    request.cookies = renderCookieStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sessionResponse()),
    );

    const session = await getSession();

    expect(session).toEqual({ user: { id: USER_ID } });
  });

  it("le magasin de cookies d'un rendu refuse bien l'écriture (garde-fou sur le message de Next)", () => {
    const store = renderCookieStore();

    const write = () => store.set("x", "y");

    expect(write).toThrow(
      /^Cookies can only be modified in a Server Action or Route Handler/,
    );
  });

  it("laisse passer toute autre erreur d'écriture de cookie", async () => {
    request.cookies = {
      ...actionCookieStore(),
      set: () => {
        throw new TypeError("panne inattendue");
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sessionResponse()),
    );

    const run = getSession();

    await expect(run).rejects.toThrow("panne inattendue");
  });

  it("écrit le cookie renouvelé hors rendu, en HttpOnly, Secure et SameSite lax", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sessionResponse()),
    );

    await getSession();

    expect(request.cookies.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "opaque",
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      }),
    );
  });

  it("renvoie null sans session", async () => {
    request.headers = new Headers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(null)),
    );

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("getSession lève « indisponible » si l'auth est injoignable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const run = getSession();

    await expect(run).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it.each([
    ["une erreur 500", 500],
    ["une limite de tentatives (429)", 429],
  ])("getSession lève « indisponible » sur %s", async (_label, status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}, { status })),
    );

    const run = getSession();

    await expect(run).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("getSession renvoie null sans cookie de session, sans appeler l'auth", async () => {
    request.headers = new Headers();
    request.cookies = actionCookieStore();
    const fetchMock = vi.fn(async () => sessionResponse());
    vi.stubGlobal("fetch", fetchMock);

    const session = await getSession();

    expect(session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("getSession renvoie null quand l'auth refuse la session (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("getSessionToken renvoie le JWT de l'endpoint /token, pas le jeton de session opaque", async () => {
    request.cookies = renderCookieStore();
    const fetchMock = vi.fn<(url: string | URL) => Promise<Response>>(
      async () => Response.json({ token: "eyJ.jwt.signe" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await getSessionToken();

    expect(token).toBe("eyJ.jwt.signe");
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE_URL}/token`);
  });

  it("getSessionToken envoie les cookies posés plus tôt dans la même action (juste après la connexion)", async () => {
    request.headers = new Headers();
    const store = MutableRequestCookiesAdapter.wrap(new RequestCookies(request.headers));
    store.set(SESSION_COOKIE, "neuf");
    request.cookies = store;
    const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(
      async () => Response.json({ token: "eyJ.jwt.signe" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = await getSessionToken();

    expect(token).toBe("eyJ.jwt.signe");
    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(sent.get("cookie")).toBe(`${SESSION_COOKIE}=neuf`);
  });

  it("envoie à l'auth les mêmes cookies que le parseur du SDK (guillemets, %3D)", async () => {
    request.headers = new Headers({
      cookie: `${SESSION_COOKIE}="abc%3D.def"; autre=1; __Secure-neon-auth.local.session_data=x%3Dy`,
    });
    request.cookies = renderCookieStore();
    const fetchMock = vi.fn<
      (url: string | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({ token: "eyJ.jwt.signe" }));
    vi.stubGlobal("fetch", fetchMock);

    await getSessionToken();

    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(sent.get("cookie")).toBe(extractNeonAuthCookies(request.headers));
  });

  it("lit les cookies renouvelés par le proxy, fusionnés dans cookies() et non dans l'en-tête d'origine", async () => {
    const renewed = new Headers({ cookie: `${SESSION_COOKIE}=renouvele` });
    request.headers = new Headers({ cookie: `${SESSION_COOKIE}=ancien` });
    request.cookies = RequestCookiesAdapter.seal(new RequestCookies(renewed));
    const fetchMock = vi.fn<
      (url: string | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({ token: "eyJ.jwt.signe" }));
    vi.stubGlobal("fetch", fetchMock);

    await getSessionToken();

    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(sent.get("cookie")).toBe(`${SESSION_COOKIE}=renouvele`);
  });

  it("getSessionToken renvoie null sans cookie de session, sans appeler l'auth", async () => {
    request.headers = new Headers();
    request.cookies = actionCookieStore();
    const fetchMock = vi.fn(async () => Response.json({ token: "x" }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await getSessionToken();

    expect(token).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["une erreur 500", () => Response.json({}, { status: 500 })],
    ["une erreur 503", () => Response.json({}, { status: 503 })],
    ["une limite de tentatives (429)", () => Response.json({}, { status: 429 })],
  ])(
    "getSessionToken lève « indisponible » sur %s, sans rien renvoyer qui mène à /login",
    async (_label, respond) => {
      vi.stubGlobal("fetch", vi.fn(async () => respond()));

      const run = getSessionToken();

      await expect(run).rejects.toBeInstanceOf(AuthUnavailableError);
    },
  );

  it("getSessionToken lève « indisponible » si l'auth est injoignable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    const run = getSessionToken();

    await expect(run).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("getSessionToken renvoie null sans session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ message: "Unauthorized" }, { status: 401 }),
      ),
    );

    const token = await getSessionToken();

    expect(token).toBeNull();
  });
});

describe("configuration de l'auth", () => {
  it("une configuration invalide n'est pas confondue avec une indisponibilité de l'auth", async () => {
    vi.resetModules();
    vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "trop-court");
    const fresh = await import("./server");

    const error = await fresh.getSessionToken().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(fresh.AuthUnavailableError);
  });
});
