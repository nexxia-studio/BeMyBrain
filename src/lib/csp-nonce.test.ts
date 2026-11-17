// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestHeaders = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => requestHeaders.get(name) ?? null,
  }),
}));

import { CSP_NONCE_MARKER_HEADER, readCspNonce } from "./csp-nonce";
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
    requestHeaders.set(CSP_NONCE_MARKER_HEADER, "bm9uY2U=");

    expect(await readCspNonce()).toBe("bm9uY2U=");
  });

  it("ignore un en-tête CSP envoyé par le client sans marqueur du proxy", async () => {
    requestHeaders.set(
      "content-security-policy",
      contentSecurityPolicy({ nonce: "Y2xpZW50", isDevelopment: false }),
    );

    expect(await readCspNonce()).toBeUndefined();
  });

  it("ignore un marqueur qui ne correspond pas au nonce de la CSP", async () => {
    requestHeaders.set(
      "content-security-policy",
      contentSecurityPolicy({ nonce: "Y2xpZW50", isDevelopment: false }),
    );
    requestHeaders.set(CSP_NONCE_MARKER_HEADER, "YXV0cmU=");

    expect(await readCspNonce()).toBeUndefined();
  });

  it("renvoie undefined sans CSP (aucun script en ligne ne sera exécuté)", async () => {
    expect(await readCspNonce()).toBeUndefined();
  });
});
