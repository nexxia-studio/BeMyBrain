// @vitest-environment node
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  store: null as unknown as {
    get: (name: string) => { value: string } | undefined;
    set: (...args: never[]) => unknown;
  },
}));

vi.mock("next/headers", () => ({ cookies: async () => request.store }));

import { syncLocaleCookie } from "./locale-cookie";

function actionStore(current?: string) {
  return {
    get: (name: string) =>
      name === "NEXT_LOCALE" && current ? { value: current } : undefined,
    set: vi.fn(),
  };
}

beforeEach(() => {
  request.store = actionStore();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("syncLocaleCookie", () => {
  it("écrit NEXT_LOCALE en httpOnly, sameSite lax, chemin /, pour un an", async () => {
    request.store = actionStore("fr");

    await syncLocaleCookie("en");

    expect(request.store.set).toHaveBeenCalledWith("NEXT_LOCALE", "en", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });
  });

  it("pose Secure en production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await syncLocaleCookie("fr");

    expect(request.store.set).toHaveBeenCalledWith(
      "NEXT_LOCALE",
      "fr",
      expect.objectContaining({ secure: true }),
    );
  });

  it("n'écrit rien si le cookie vaut déjà la locale", async () => {
    request.store = actionStore("en");

    await syncLocaleCookie("en");

    expect(request.store.set).not.toHaveBeenCalled();
  });

  it("pendant un rendu de Server Component, n'écrit pas et ne plante pas", async () => {
    request.store = RequestCookiesAdapter.seal(
      new RequestCookies(new Headers({ cookie: "NEXT_LOCALE=fr" })),
    );

    const run = syncLocaleCookie("en");

    await expect(run).resolves.toBeUndefined();
  });

  it("laisse passer toute autre erreur d'écriture", async () => {
    request.store = {
      ...actionStore(),
      set: () => {
        throw new TypeError("panne inattendue");
      },
    };

    const run = syncLocaleCookie("en");

    await expect(run).rejects.toThrow("panne inattendue");
  });
});
