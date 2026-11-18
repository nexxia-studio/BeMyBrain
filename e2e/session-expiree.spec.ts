import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { credentials, signIn } from "./session";

// QA-1 du plan socle : session expirée pendant une action → /login, puis retour sur la page d'origine.
// Expiration simulée côté navigateur, faute de pouvoir faire expirer une session Neon Auth à la demande :
// cookies de l'auth retirés (le navigateur les jette à l'expiration), ou jeton de session remplacé par une
// valeur que Neon Auth refuse (session révoquée ou expirée côté serveur, cookie encore présent).
// Le scénario ne dépend pas de la largeur : ordinateur seulement.
test.use({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });

const AUTH_COOKIES = /^__Secure-neon-auth\./;
const SESSION_COOKIE = "__Secure-neon-auth.session_token";

const expirations: Record<string, (context: BrowserContext) => Promise<void>> =
  {
    "cookies de session disparus": (context) =>
      context.clearCookies({ name: AUTH_COOKIES }),
    "session refusée par l'auth": async (context) => {
      const token = (await context.cookies()).find(
        (cookie) => cookie.name === SESSION_COOKIE,
      );
      if (!token) throw new Error("cookie de session absent après connexion");
      // Cache de session du SDK retiré aussi : il est expiré au bout de 5 min dans le cas réel.
      await context.clearCookies({ name: /^__Secure-neon-auth\.local\./ });
      await context.addCookies([{ ...token, value: "session-expiree" }]);
    },
  };

function proButton(page: Page) {
  return page
    .getByRole("group", { name: fr.shell.side.label })
    .getByRole("button", { name: fr.shell.side.pro });
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

for (const [name, expire] of Object.entries(expirations)) {
  test(
    `session expirée (${name}) pendant une action : /login, puis retour sur la page d'origine`,
    { tag: "@desktop" },
    async ({ page, context }) => {
      await signIn(page);
      await page.goto("/settings");
      await expire(context);

      await proButton(page).click();

      await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
      await expect(page.getByText(fr.shell.preferenceError)).toHaveCount(0);
      const { email, password } = credentials();
      await page.getByLabel(fr.auth.login.email).fill(email);
      await page.getByLabel(fr.auth.login.password).fill(password);
      await page.getByRole("button", { name: fr.auth.login.submit }).click();
      await expect(page).toHaveURL(/\/settings$/);
    },
  );
}
