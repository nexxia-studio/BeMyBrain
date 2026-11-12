import { expect, test } from "@playwright/test";
import { createTranslator } from "next-intl";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";

// Scénario 2 de la spec socle (bascule Privé / Pro), desktop et mobile. Les contextes Pro sont ceux du
// seed de la branche visée (Trustup, Nexxia : scripts/seed.ts).
test.use({ locale: "fr-FR" });

const t = createTranslator({ locale: "fr", messages: fr });
// Deux contextes Pro dans le seed : libellé « tous » au pluriel =2.
const BOTH = t("shell.contexts.all", { count: 2 });

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("passe en Pro, filtre sur Nexxia, recharge et retrouve le même état", async ({
  page,
  context,
}) => {
  const violations = await watchCspViolations(page);
  await signIn(page);
  const side = page.getByRole("group", { name: fr.shell.side.label });
  const filter = page.getByRole("group", { name: fr.shell.contexts.label });
  const both = filter.getByRole("button", { name: BOTH });
  const nexxia = filter.getByRole("button", { name: "Nexxia" });

  await side.getByRole("button", { name: fr.shell.side.pro }).click();
  await expect(both).toHaveAttribute("aria-pressed", "true");
  await nexxia.click();
  await expect(nexxia).toHaveAttribute("aria-pressed", "true");
  // La Server Action a posé le cookie avant le rechargement (l'interface est optimiste).
  await expect
    .poll(async () =>
      (await context.cookies()).some((c) => c.name === "bmb_contexts"),
    )
    .toBe(true);
  await page.reload();

  await expect(
    side.getByRole("button", { name: fr.shell.side.pro }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    side.getByRole("button", { name: fr.shell.side.private }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(nexxia).toHaveAttribute("aria-pressed", "true");
  await expect(both).toHaveAttribute("aria-pressed", "false");
  expect(violations).toEqual([]);
});

test("côté Privé, aucun filtre de contexte n'est proposé", async ({ page }) => {
  await signIn(page);

  await expect(
    page
      .getByRole("group", { name: fr.shell.side.label })
      .getByRole("button", { name: fr.shell.side.private }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("group", { name: fr.shell.contexts.label }),
  ).toHaveCount(0);
});

test("la première bascule marque le moment signature comme joué pour la session", async ({
  page,
}) => {
  await signIn(page);
  const side = page.getByRole("group", { name: fr.shell.side.label });
  const pro = side.getByRole("button", { name: fr.shell.side.pro });
  const marker = () =>
    page.evaluate(() => sessionStorage.getItem("bmb_signature_side_switch"));
  expect(await marker()).toBeNull();

  await pro.click();
  await expect(pro).toHaveAttribute("aria-pressed", "true");

  await expect.poll(marker).not.toBeNull();
});
