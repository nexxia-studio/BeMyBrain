// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  contentSecurityPolicy,
  createNonce,
  securityHeaders,
} from "./security-headers";

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values] as const;
      }),
  );
}

describe("politique de sécurité du contenu", () => {
  it("n'autorise en production que les scripts portant le nonce de la requête", () => {
    const policy = directives(
      contentSecurityPolicy({ nonce: "abc123", isDevelopment: false }),
    );

    expect(policy.get("script-src")).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
    ]);
  });

  it("ajoute unsafe-eval en développement seulement (pile d'erreurs de React)", () => {
    const dev = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: true }),
    );
    const prod = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: false }),
    );

    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(prod.get("script-src")).not.toContain("'unsafe-eval'");
  });

  it("n'autorise jamais un script en ligne sans nonce", () => {
    for (const isDevelopment of [true, false]) {
      const policy = directives(
        contentSecurityPolicy({ nonce: "n", isDevelopment }),
      );

      expect(policy.get("script-src")).not.toContain("'unsafe-inline'");
    }
  });

  it("interdit l'affichage de l'app dans un cadre", () => {
    const policy = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: false }),
    );

    expect(policy.get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("limite toutes les autres sources à l'origine de l'app", () => {
    const policy = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: false }),
    );

    expect(policy.get("default-src")).toEqual(["'self'"]);
    expect(policy.get("connect-src")).toEqual(["'self'"]);
    expect(policy.get("font-src")).toEqual(["'self'"]);
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
  });

  it("passe les sous-ressources en HTTPS en production seulement", () => {
    const prod = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: false }),
    );
    const dev = directives(
      contentSecurityPolicy({ nonce: "n", isDevelopment: true }),
    );

    expect(prod.has("upgrade-insecure-requests")).toBe(true);
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("nonce", () => {
  it("est un base64 d'au moins 128 bits, différent à chaque requête", () => {
    const first = createNonce();
    const second = createNonce();

    expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(Buffer.from(first, "base64").length).toBeGreaterThanOrEqual(16);
    expect(first).not.toBe(second);
  });
});

describe("en-têtes de sécurité", () => {
  function asRecord(headers: { key: string; value: string }[]) {
    return Object.fromEntries(headers.map(({ key, value }) => [key, value]));
  }

  it("refusent le cadre, le reniflage de type et limitent le référent", () => {
    const headers = asRecord(securityHeaders({ isProduction: false }));

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("coupent caméra, micro, géolocalisation et paiement", () => {
    const headers = asRecord(securityHeaders({ isProduction: false }));

    for (const feature of ["camera", "microphone", "geolocation", "payment"]) {
      expect(headers["Permissions-Policy"]).toContain(`${feature}=()`);
    }
  });

  it("imposent HTTPS (HSTS) en production seulement", () => {
    const prod = asRecord(securityHeaders({ isProduction: true }));
    const dev = asRecord(securityHeaders({ isProduction: false }));

    expect(prod["Strict-Transport-Security"]).toMatch(/^max-age=\d{8,}/);
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });
});
