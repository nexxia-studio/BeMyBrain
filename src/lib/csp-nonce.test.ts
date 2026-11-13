// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.get(name) ?? null }),
}));

import { readCspNonce } from "./csp-nonce";
import { contentSecurityPolicy } from "./security-headers";

beforeEach(() => {
  requestHeaders.clear();
});

describe("nonce CSP de la requête", () => {
  it("lit le nonce posé par le proxy dans la CSP de la requête", async () => {
    requestHeaders.set(
      "content-security-policy",
      contentSecurityPolicy({ nonce: "bm9uY2U=", isDevelopment: false }),
    );

    expect(await readCspNonce()).toBe("bm9uY2U=");
  });

  it("renvoie undefined sans CSP (aucun script en ligne ne sera exécuté)", async () => {
    expect(await readCspNonce()).toBeUndefined();
  });
});
