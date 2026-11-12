import { expect, test } from "@playwright/test";

import { watchCspViolations } from "./csp";

// Audit de la tâche 10 du socle : en-têtes de sécurité et CSP à nonce. Chromium desktop (tag @desktop).
test.describe("en-têtes de sécurité", { tag: "@desktop" }, () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("/login répond avec la CSP à nonce et les en-têtes de sécurité", async ({
    page,
  }) => {
    const response = await page.goto("/login");

    const headers = response!.headers();
    expect(headers["content-security-policy"]).toMatch(/'nonce-[^']+'/);
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("/login se charge et s'hydrate sans aucune violation de la CSP", async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);

    await page.goto("/login");
    // Le runtime client de Next ne s'installe que si ses scripts (avec nonce) ont tourné.
    await page.waitForFunction(
      () =>
        (window as unknown as { next?: { version?: string } }).next?.version,
    );
    await page.waitForLoadState("networkidle");

    expect(violations).toEqual([]);
  });

  test("chaque chargement de /login reçoit un nonce différent", async ({
    request,
  }) => {
    const nonceOf = (policy: string | undefined) =>
      policy?.match(/'nonce-([^']+)'/)?.[1];

    const first = await request.get("/login");
    const second = await request.get("/login");

    expect(nonceOf(first.headers()["content-security-policy"])).toBeTruthy();
    expect(nonceOf(first.headers()["content-security-policy"])).not.toBe(
      nonceOf(second.headers()["content-security-policy"]),
    );
  });
});
