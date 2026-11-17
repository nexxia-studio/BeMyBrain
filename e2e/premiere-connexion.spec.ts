import { expect, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";

// Scénario 1 de la spec socle (première connexion) : Antoine se connecte et obtient le tableau de bord
// avec ses espaces. Espaces de la branche visée (compte e2e sur dev, workspace « BeMyBrain ») : un seul
// côté Privé (« Privé »), Trustup et Nexxia côté Pro. Chaque bloc fixe sa largeur : il tourne à
// l'identique dans les deux projets Playwright.
test.use({ locale: "fr-FR" });

const PRIVATE_TILES = ["privateTodo", "shopping", "budget", "health", "home"];
const PRO_TILES = ["proTodo", "clients", "proFinances", "social"];
const ENTRANCE_MARKER = "bmb_signature_dashboard_intro";

const tile = (page: Page, id: string) => page.getByTestId(`tile-${id}`);

async function box(page: Page, id: string) {
  const bounds = await tile(page, id).boundingBox();
  if (!bounds) throw new Error(`tuile ${id} sans boîte`);
  return bounds;
}

/** Attend la fin de l'entrée : plus aucune cible masquée, transparente ou déplacée. */
async function waitForEntrance(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(
            "[data-signature], [data-signature-item]",
          ),
        ].every((element) => {
          const style = getComputedStyle(element);
          return (
            style.opacity === "1" &&
            style.visibility === "visible" &&
            style.transform === "none"
          );
        }),
      ),
    )
    .toBe(true);
}

/** Le tableau de bord du côté Privé est là, entrée jouée, tuiles visibles. */
async function expectPrivateDashboard(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: fr.dashboard.title }),
  ).toBeVisible();
  const today = tile(page, "today");
  await expect(today).toBeVisible();
  await expect(today).toContainText(fr.dashboard.today.greeting);
  // Espace du côté Privé, nommé par la tuile « Aujourd'hui ».
  await expect(today).toContainText("Privé");
  for (const id of PRIVATE_TILES) {
    await expect(tile(page, id)).toBeVisible();
  }
  for (const id of PRO_TILES) {
    await expect(tile(page, id)).toHaveCount(0);
  }
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.describe("ordinateur (1440 px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("se connecte et arrive sur le tableau de bord bento de son workspace", async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);

    await signIn(page);

    await expectPrivateDashboard(page);
    await waitForEntrance(page);
    await expect(
      page.getByRole("navigation", { name: fr.shell.navigation }).first(),
    ).toBeVisible();
    // Rangées de 2 à 3 tuiles : la tuile pleine et la To-do partagent la première.
    const [today, todo] = [
      await box(page, "today"),
      await box(page, "privateTodo"),
    ];
    expect(Math.abs(today.y - todo.y)).toBeLessThan(1);
    expect(todo.x).toBeGreaterThan(today.x);
    expect(violations).toEqual([]);
  });
});

test.describe("mobile (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("se connecte et obtient une colonne de tuiles, sauf la paire de tuiles chiffre", async ({
    page,
  }) => {
    const violations = await watchCspViolations(page);

    await signIn(page);

    await expectPrivateDashboard(page);
    await waitForEntrance(page);
    const [today, todo, shopping, budget, health] = await Promise.all(
      ["today", "privateTodo", "shopping", "budget", "health"].map((id) =>
        box(page, id),
      ),
    );
    // Une colonne : même bord gauche, l'une sous l'autre.
    expect(todo.x).toBeCloseTo(today.x, 0);
    expect(todo.y).toBeGreaterThan(today.y + today.height - 1);
    expect(health.x).toBeCloseTo(today.x, 0);
    // La paire de tuiles chiffre partage une rangée (DESIGN.md § 8, décision 9).
    expect(Math.abs(shopping.y - budget.y)).toBeLessThan(1);
    expect(budget.x).toBeGreaterThan(shopping.x);
    expect(violations).toEqual([]);
  });
});

test("l'entrée du tableau de bord est marquée jouée pour la session, puis ne rejoue pas", async ({
  page,
}) => {
  await signIn(page);
  const marker = () =>
    page.evaluate((key) => sessionStorage.getItem(key), ENTRANCE_MARKER);
  await expect.poll(marker).not.toBeNull();

  await page.reload();

  await expect(page.locator("html")).not.toHaveAttribute(
    "data-signature-pending",
    /.+/,
  );
  await expect(tile(page, "today")).toBeVisible();
});

test.describe("mouvement réduit", () => {
  test.use({ reducedMotion: "reduce" });

  test("aucune animation ne démarre", async ({ page }) => {
    await signIn(page);
    // Les moments se sont chargés et ont tranché (marqueur posé même sous mouvement réduit).
    await expect
      .poll(() =>
        page.evaluate((key) => sessionStorage.getItem(key), ENTRANCE_MARKER),
      )
      .not.toBeNull();

    // Échantillonne 20 images : rien n'est masqué, transparent ou déplacé, aucune animation Web.
    const frames = await page.evaluate(async () => {
      const samples: string[] = [];
      for (let frame = 0; frame < 20; frame += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (document.documentElement.hasAttribute("data-signature-pending")) {
          samples.push("cibles masquées");
        }
        for (const element of document.querySelectorAll(
          "[data-signature], [data-signature-item]",
        )) {
          const style = getComputedStyle(element);
          if (
            style.opacity !== "1" ||
            style.visibility !== "visible" ||
            style.transform !== "none"
          ) {
            samples.push(
              `${element.getAttribute("data-signature") ?? "item"} : ${style.opacity} ${style.visibility} ${style.transform}`,
            );
          }
        }
        if (document.getAnimations().length > 0) samples.push("animation Web");
      }
      return samples;
    });

    expect(frames).toEqual([]);
  });
});
