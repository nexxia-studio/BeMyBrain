// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import proxy, { config } from "./proxy";

const ORIGIN = "http://localhost:3000";
// Jeton de session au nom exact du SDK (`__Secure-neon-auth.session_token`).
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, ORIGIN), {
    headers: cookie ? { cookie } : {},
  });
}

function isAllowed(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  // Jamais l'auth réelle de dev : aucune requête ne doit sortir de ce test.
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "s".repeat(32));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("proxy d'authentification", () => {
  it.each([
    "/login",
    "/reset-password",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
  ])("laisse passer %s sans session", async (path) => {
    const response = await proxy(request(path));

    expect(isAllowed(response)).toBe(true);
  });

  it.each(["/dashboard", "/", "/settings"])(
    "redirige %s sans session vers /login",
    async (path) => {
      const response = await proxy(request(path));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location")!).pathname).toBe(
        "/login",
      );
    },
  );

  it("redirige /dashboard avec un cookie de session que l'auth ne reconnaît pas", async () => {
    const fetchMock = vi.fn(async () => Response.json(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      request("/dashboard", `${SESSION_COOKIE}=jeton-forge`),
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("laisse passer /dashboard quand l'auth reconnaît la session", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        session: {
          id: "s1",
          token: "opaque",
          userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-11-12T00:00:00.000Z",
          updatedAt: "2026-11-12T00:00:00.000Z",
        },
        user: {
          id: "dc42fa70-09a7-4038-a3bb-f61dda854910",
          createdAt: "2026-11-12T00:00:00.000Z",
          updatedAt: "2026-11-12T00:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      request("/dashboard", `${SESSION_COOKIE}=opaque`),
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(isAllowed(response)).toBe(true);
  });

  it("ne protège pas /reset-password-bis par erreur de préfixe", async () => {
    const response = await proxy(request("/reset-password-bis"));

    expect(response.status).toBe(307);
  });
});

describe("matcher du proxy", () => {
  it.each([
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/apple-icon.png",
    "/favicon.ico",
    "/_next/static/chunks/app.js",
    "/_next/image?url=%2Ficons%2Ficon-192.png&w=64&q=75",
  ])("n'exécute pas le proxy sur l'asset statique %s", (path) => {
    const matched = unstable_doesMiddlewareMatch({
      config,
      url: new URL(path, ORIGIN).toString(),
    });

    expect(matched).toBe(false);
  });

  it.each(["/dashboard", "/", "/login", "/reset-password", "/settings/langue"])(
    "exécute le proxy sur la page %s",
    (path) => {
      const matched = unstable_doesMiddlewareMatch({
        config,
        url: new URL(path, ORIGIN).toString(),
      });

      expect(matched).toBe(true);
    },
  );
});
