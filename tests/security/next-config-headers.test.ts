// @vitest-environment node
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "../../next.config";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function headersOf(path: string) {
  const response = await unstable_getResponseFromNextConfig({
    url: `https://app.example.test${path}`,
    nextConfig,
  });
  return response.headers;
}

describe("en-têtes de next.config", () => {
  it.each(["/login", "/manifest.webmanifest", "/icons/icon-192.png"])(
    "pose les en-têtes de sécurité sur %s",
    async (path) => {
      const headers = await headersOf(path);

      expect(headers.get("x-frame-options")).toBe("DENY");
      expect(headers.get("x-content-type-options")).toBe("nosniff");
      expect(headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headers.get("permissions-policy")).toContain("camera=()");
    },
  );

  it("ajoute HSTS au build de production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const headers = await headersOf("/login");

    expect(headers.get("strict-transport-security")).toMatch(/^max-age=/);
  });

  it("ne pose pas la CSP : elle porte un nonce par requête, posé par le proxy", async () => {
    const headers = await headersOf("/login");

    expect(headers.get("content-security-policy")).toBeNull();
  });
});
