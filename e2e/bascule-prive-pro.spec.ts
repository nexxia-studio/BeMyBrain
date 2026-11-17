import { expect, type Page, test } from "@playwright/test";
import { createTranslator } from "next-intl";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";

// Scénario 2 de la spec socle (bascule Privé / Pro et filtre d'espace). Espaces de la branche visée
// (compte e2e sur dev, workspace « BeMyBrain ») : un seul côté Privé, Trustup et Nexxia côté Pro.
// Le filtre vit dans la barre latérale sur ordinateur, dans une pastille à côté du titre sur mobile :
// chaque bloc fixe sa largeur, il tourne donc à l'identique dans les deux projets Playwright.
test.use({ locale: "fr-FR" });

const t = createTranslator({ locale: "fr", messages: fr });
// Deux espaces Pro : libellé « tous » au pluriel =2.
const BOTH = t("shell.contexts.all", { count: 2 });
// Le nom accessible de la pastille porte le choix courant : on la trouve par son préfixe.
const MENU_TRIGGER = new RegExp(`^${fr.shell.contexts.label}`);

function sideButton(page: Page, side: "private" | "pro") {
  return page
    .getByRole("group", { name: fr.shell.side.label })
    .getByRole("button", { name: fr.shell.side[side] });
}

async function switchToPro(page: Page) {
  const pro = sideButton(page, "pro");
  await pro.click();
  await expect(pro).toHaveAttribute("aria-pressed", "true");
}

/** La Server Action a posé le cookie avant le rechargement (l'interface est optimiste). */
async function expectCookie(page: Page, name: string) {
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) => c.name === name),
    )
    .toBe(true);
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("ordinateur (1440 px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("filtre sur Nexxia dans la barre latérale, recharge et retrouve le même état", async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);
    await signIn(page);
    const filter = page
      .getByRole("navigation", { name: fr.shell.navigation })
      .getByRole("group", { name: fr.shell.contexts.label });
    const both = filter.getByRole("button", { name: BOTH });
    const nexxia = filter.getByRole("button", { name: "Nexxia" });

    await switchToPro(page);
    await expect(both).toHaveAttribute("aria-pressed", "true");
    await nexxia.click();
    await expect(nexxia).toHaveAttribute("aria-pressed", "true");
    await expectCookie(page, "bmb_contexts_pro");
    await page.reload();

    await expect(sideButton(page, "pro")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(nexxia).toHaveAttribute("aria-pressed", "true");
    await expect(both).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { name: MENU_TRIGGER })).toHaveCount(
      0,
    );
    expect(violations).toEqual([]);
  });

  test("côté Privé (un seul espace), aucun filtre n'est proposé", async ({
    page,
  }) => {
    await signIn(page);

    await expect(sideButton(page, "private")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("group", { name: fr.shell.contexts.label }),
    ).toHaveCount(0);
  });
});

test.describe("mobile (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("choisit Nexxia par la pastille à côté du titre, recharge et retrouve le même état", async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);
    await signIn(page);
    const trigger = page.getByRole("button", { name: MENU_TRIGGER });

    await switchToPro(page);
    await expect(trigger).toContainText(BOTH);
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("menuitemradio", { name: "Nexxia" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toContainText("Nexxia");
    await expectCookie(page, "bmb_contexts_pro");
    await page.reload();

    await expect(trigger).toContainText("Nexxia");
    await expect(
      page.getByRole("group", { name: fr.shell.contexts.label }),
    ).toHaveCount(0);
    expect(violations).toEqual([]);
  });

  test("le menu se ferme avec Échap et rend le focus à la pastille", async ({
    page,
  }) => {
    await signIn(page);
    await switchToPro(page);
    const trigger = page.getByRole("button", { name: MENU_TRIGGER });
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("côté Privé (un seul espace), aucune pastille n'est proposée", async ({
    page,
  }) => {
    await signIn(page);

    await expect(sideButton(page, "private")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: MENU_TRIGGER })).toHaveCount(
      0,
    );
  });
});

test("la première bascule marque le moment signature comme joué pour la session", async ({
  page,
}) => {
  await signIn(page);
  const marker = () =>
    page.evaluate(() => sessionStorage.getItem("bmb_signature_side_switch"));
  expect(await marker()).toBeNull();

  await switchToPro(page);

  await expect.poll(marker).not.toBeNull();
});
