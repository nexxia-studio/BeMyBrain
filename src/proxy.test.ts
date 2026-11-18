// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { CSP_NONCE_MARKER_HEADER } from "./lib/security-headers";
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
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/icons/apple-touch-icon.png",
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

  // QA-1 : le 307 vers /login sur le POST d'une Server Action est suivi par le fetch du client ; /login
  // répond sans flux RSC, le client lève « An unexpected response… » et affiche un échec au lieu de
  // naviguer. L'action se garde elle-même (requireSession → redirect lisible par le client).
  function actionRequest(path: string, cookie?: string) {
    return new NextRequest(new URL(path, ORIGIN), {
      method: "POST",
      headers: {
        "next-action": "408598b1af6ee1d3946827f5f62fd65e1f908928e8",
        ...(cookie ? { cookie } : {}),
      },
    });
  }

  it("laisse passer une Server Action sans session : l'action renvoie elle-même vers /login", async () => {
    const response = await proxy(actionRequest("/dashboard"));

    expect(isAllowed(response)).toBe(true);
    expect(response.headers.get("location")).toBeNull();
  });

  it("laisse passer une Server Action dont la session est refusée par l'auth, avec la CSP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(null, { status: 401 })),
    );

    const response = await proxy(
      actionRequest("/settings", `${SESSION_COOKIE}=expire`),
    );

    expect(isAllowed(response)).toBe(true);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("laisse passer une Server Action en gardant l'effacement du cache de session périmé posé par le SDK", async () => {
    // Cache de session sans jeton de session : le SDK décide /login et efface le cache (Set-Cookie maxAge 0).
    const stale = "__Secure-neon-auth.local.session_data";

    const response = await proxy(
      actionRequest("/settings", `${stale}=cache-perime`),
    );

    expect(isAllowed(response)).toBe(true);
    expect(response.headers.get("location")).toBeNull();
    const cleared = response.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith(`${stale}=;`));
    expect(cleared).toMatch(/Max-Age=0/i);
  });

  it("redirige toujours un POST sans en-tête Next-Action (formulaire sans JavaScript)", async () => {
    const response = await proxy(
      new NextRequest(new URL("/dashboard", ORIGIN), { method: "POST" }),
    );

    expect(response.status).toBe(307);
  });

  it("ne protège pas /reset-password-bis par erreur de préfixe", async () => {
    const response = await proxy(request("/reset-password-bis"));

    expect(response.status).toBe(307);
  });
});

describe("politique de sécurité du contenu posée par le proxy", () => {
  function nonceOf(policy: string | null) {
    return policy?.match(/'nonce-([^']+)'/)?.[1];
  }

  it("pose sur /login une CSP à nonce, aussi transmise au rendu de la page", async () => {
    const response = await proxy(request("/login"));

    const policy = response.headers.get("content-security-policy");
    expect(nonceOf(policy)).toBeTruthy();
    // Next lit le nonce dans l'en-tête de requête transmis par le proxy.
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(policy);
  });

  it("tire un nonce différent à chaque requête", async () => {
    const first = await proxy(request("/login"));
    const second = await proxy(request("/login"));

    expect(nonceOf(first.headers.get("content-security-policy"))).not.toBe(
      nonceOf(second.headers.get("content-security-policy")),
    );
  });

  it("pose la CSP sur une URL à extension inexistante (/x.png), rendue en 404 HTML par Next", async () => {
    const response = await proxy(request("/x.png"));

    expect(
      nonceOf(response.headers.get("content-security-policy")),
    ).toBeTruthy();
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(response.headers.get("content-security-policy"));
  });

  it("ne redirige pas une URL à extension vers /login : Next répond 404", async () => {
    const response = await proxy(request("/apple-touch-icon.png"));

    expect(isAllowed(response)).toBe(true);
  });

  it("transmet au rendu le marqueur de nonce, en écrasant celui du client", async () => {
    const forged = new NextRequest(new URL("/login", ORIGIN), {
      headers: { [CSP_NONCE_MARKER_HEADER]: "forge" },
    });

    const response = await proxy(forged);

    const nonce = nonceOf(response.headers.get("content-security-policy"));
    expect(
      response.headers.get(`x-middleware-request-${CSP_NONCE_MARKER_HEADER}`),
    ).toBe(nonce);
  });

  function connectSrc(policy: string | null) {
    return policy
      ?.split("; ")
      .find((directive) => directive.startsWith("connect-src "));
  }

  it("connect-src contient l'origine du DSN et rien d'autre de nouveau ; sans DSN, inchangée", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const without = await proxy(request("/login"));
    vi.stubEnv("SENTRY_DSN", "https://clepublique@o1.ingest.de.sentry.io/42");

    const withDsn = await proxy(request("/login"));

    expect(connectSrc(without.headers.get("content-security-policy"))).toBe(
      "connect-src 'self'",
    );
    expect(connectSrc(withDsn.headers.get("content-security-policy"))).toBe(
      "connect-src 'self' https://o1.ingest.de.sentry.io",
    );
    expect(
      withDsn.headers.get("x-middleware-request-content-security-policy"),
    ).toContain("https://o1.ingest.de.sentry.io");
  });

  it.each([
    "http://cle@o1.ingest.sentry.io/42",
    "pas une url",
    "https://cle@o1.ingest.example.test/42",
  ])(
    "n'élargit pas connect-src pour un DSN non https, invalide ou hors sentry.io (%s)",
    async (dsn) => {
      vi.stubEnv("SENTRY_DSN", dsn);

      const response = await proxy(request("/login"));

      expect(connectSrc(response.headers.get("content-security-policy"))).toBe(
        "connect-src 'self'",
      );
    },
  );

  it("pose aussi la CSP sur la redirection vers /login", async () => {
    const response = await proxy(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
  });
});

describe("matcher du proxy", () => {
  it.each([
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-maskable-512.png",
    "/icons/apple-touch-icon.png",
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

  it("n'exclut que les icônes réellement servies par public/icons", () => {
    const icons = readdirSync(join(process.cwd(), "public/icons"));

    const unmatched = icons.filter(
      (name) =>
        !unstable_doesMiddlewareMatch({
          config,
          url: new URL(`/icons/${name}`, ORIGIN).toString(),
        }),
    );

    expect(unmatched.sort()).toEqual([...icons].sort());
  });

  it.each([
    "/dashboard",
    "/",
    "/login",
    "/reset-password",
    "/settings/langue",
    "/x.png",
    "/inexistant.svg",
    "/robots.txt",
    "/icons/inexistant.png",
    "/apple-touch-icon.png",
  ])("exécute le proxy sur %s (toute réponse HTML porte la CSP)", (path) => {
    const matched = unstable_doesMiddlewareMatch({
      config,
      url: new URL(path, ORIGIN).toString(),
    });

    expect(matched).toBe(true);
  });
});
