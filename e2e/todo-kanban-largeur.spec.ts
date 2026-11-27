import { expect, test } from "@playwright/test";

import { signIn } from "./session";
import { boardColumn, openBoard, setBoardPreferences } from "./todo";

// Tableau sur ordinateur (décision d'Antoine du 2026-11-27) : plafond de 1400 px levé, colonnes de 320 px, fondu
// à droite quand des colonnes dépassent encore. Aucune donnée créée : lecture seule de la géométrie.
test.use({ locale: "fr-FR" });
test.describe.configure({ timeout: 60_000 });

for (const width of [1280, 1920]) {
  test(`@desktop le tableau occupe la largeur de la fenêtre à ${width} px, colonnes de 320 px`, async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await setBoardPreferences(page);
    await openBoard(page);

    const row = page.locator("[data-board-columns]");
    const column = boardColumn(page, "unstarted");
    const metrics = await row.evaluate((el) => ({
      rowWidth: el.getBoundingClientRect().width,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      moreEnd: el.hasAttribute("data-more-end"),
    }));
    const columnWidth = (await column.boundingBox())?.width ?? 0;

    test.info().annotations.push({
      type: "mesure",
      description: `rangée ${Math.round(metrics.rowWidth)} px, contenu ${metrics.scrollWidth} px, fondu ${metrics.moreEnd}`,
    });
    expect(Math.round(columnWidth)).toBe(320);
    // Le plafond de 1400 px est levé : au-delà de 1400 px de fenêtre, la rangée dépasse 1400 px moins la barre latérale.
    if (width > 1500) expect(metrics.rowWidth).toBeGreaterThan(1300);
    // Fondu à droite si et seulement si des colonnes restent hors champ.
    expect(metrics.moreEnd).toBe(metrics.scrollWidth > metrics.clientWidth + 1);
  });
}
