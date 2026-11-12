// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  token: vi.fn(),
}));

vi.mock("@neon/auth/next/server", () => ({
  createNeonAuth: vi.fn(() => fakeAuth),
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

import { createNeonAuth } from "@neon/auth/next/server";

import { getSession, getSessionToken } from "./server";

const USER_ID = "dc42fa70-09a7-4038-a3bb-f61dda854910";

beforeEach(() => {
  vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test/neondb/auth");
  vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "s".repeat(32));
  fakeAuth.getSession.mockReset();
  fakeAuth.token.mockReset();
});

describe("session serveur", () => {
  it("configure les cookies du SDK en sameSite lax avec le secret de l'environnement", async () => {
    fakeAuth.getSession.mockResolvedValue({ data: null, error: null });

    await getSession();

    expect(createNeonAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://auth.example.test/neondb/auth",
        cookies: { secret: "s".repeat(32), sameSite: "lax" },
      }),
    );
  });

  it("renvoie l'identifiant de l'utilisateur connecté", async () => {
    fakeAuth.getSession.mockResolvedValue({
      data: {
        session: { token: "opaque" },
        user: { id: USER_ID, email: "a@example.test" },
      },
      error: null,
    });

    const session = await getSession();

    expect(session).toEqual({ user: { id: USER_ID } });
  });

  it("renvoie null sans session", async () => {
    fakeAuth.getSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("renvoie null si l'auth est injoignable", async () => {
    fakeAuth.getSession.mockResolvedValue({
      data: null,
      error: { code: "NETWORK_DNS", message: "x", status: 502 },
    });

    const session = await getSession();

    expect(session).toBeNull();
  });

  it("getSessionToken renvoie le JWT de l'endpoint /token, pas le jeton de session opaque", async () => {
    fakeAuth.getSession.mockResolvedValue({
      data: { session: { token: "opaque" }, user: { id: USER_ID } },
      error: null,
    });
    fakeAuth.token.mockResolvedValue({
      data: { token: "eyJ.jwt.signe" },
      error: null,
    });

    const token = await getSessionToken();

    expect(token).toBe("eyJ.jwt.signe");
  });

  it("getSessionToken renvoie null sans session", async () => {
    fakeAuth.token.mockResolvedValue({
      data: null,
      error: { status: 401, message: "Unauthorized" },
    });

    const token = await getSessionToken();

    expect(token).toBeNull();
  });
});
