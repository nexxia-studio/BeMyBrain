import { expect, test } from "@playwright/test";

import { watchCspViolations } from "./csp";

// Scénario 5 de la spec socle (installer l'app). La proposition d'installation elle-même n'est
// pas observable en headless : on vérifie ce qui la conditionne (manifeste servi sans session,
// icônes présentes, liens du document). Chromium desktop seulement (tag @desktop).
type ManifestIcon = { src: string; sizes: string; type: string };

test.describe("installation de l'app", { tag: "@desktop" }, () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("/manifest.webmanifest répond 200 sans session et chaque icône déclarée existe", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as {
      display: string;
      icons: ManifestIcon[];
    };
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(icon.src, { maxRedirects: 0 });
      expect(iconResponse.status(), icon.src).toBe(200);
      expect(iconResponse.headers()["content-type"], icon.src).toBe(icon.type);
    }
  });

  test("l'écran de connexion déclare le manifeste, l'icône Apple et le favicon, servis sans session", async ({
    page,
    request,
  }) => {
    const violations = await watchCspViolations(page);

    await page.goto("/login");

    const hrefs = await page.evaluate(() =>
      Object.fromEntries(
        ["manifest", "apple-touch-icon", "icon"].map((rel) => [
          rel,
          document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.href ??
            null,
        ]),
      ),
    );

    for (const [rel, href] of Object.entries(hrefs)) {
      expect(href, rel).not.toBeNull();
      const response = await request.get(href!, { maxRedirects: 0 });
      expect(response.status(), rel).toBe(200);
    }
    expect(violations).toEqual([]);
  });
});
