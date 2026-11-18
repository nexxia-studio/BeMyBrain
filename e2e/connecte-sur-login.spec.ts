import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";

// QA-2 du plan socle : /login ouvert en étant connecté → renvoi vers le tableau de bord (ou le `next` interne).
// Ne dépend pas de la largeur : ordinateur seulement.
test.use({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });

const SESSION_COOKIE = "__Secure-neon-auth.session_token";

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test(
  "connecté, /login renvoie vers le tableau de bord",
  { tag: "@desktop" },
  async ({ page }) => {
    await signIn(page);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/dashboard$/);
  },
);

test(
  "connecté, /login?next=/settings renvoie vers les réglages",
  { tag: "@desktop" },
  async ({ page }) => {
    await signIn(page);

    await page.goto("/login?next=%2Fsettings");

    await expect(page).toHaveURL(/\/settings$/);
  },
);

test(
  "connecté, un next vers un autre site renvoie vers le tableau de bord",
  { tag: "@desktop" },
  async ({ page }) => {
    await signIn(page);

    await page.goto("/login?next=%2F%2Fexample.com");

    await expect(page).toHaveURL(/\/dashboard$/);
  },
);

test(
  "sans session, /login affiche le formulaire",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(fr.auth.login.email)).toBeVisible();
  },
);

test(
  "session présente mais refusée par l'auth : /login affiche le formulaire, sans boucle",
  { tag: "@desktop" },
  async ({ page, context }) => {
    await signIn(page);
    const token = (await context.cookies()).find(
      (cookie) => cookie.name === SESSION_COOKIE,
    );
    if (!token) throw new Error("cookie de session absent après connexion");
    // Cache de session du SDK retiré aussi : il est expiré au bout de 5 min dans le cas réel.
    await context.clearCookies({ name: /^__Secure-neon-auth\.local\./ });
    await context.addCookies([{ ...token, value: "session-refusee" }]);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(fr.auth.login.email)).toBeVisible();
  },
);
