import { expect, test, type Page } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import { uniqueTitle } from "./todo";

// Courses, ajout rapide enchaîné (spec listes, « Ajout rapide »). Quatre articles saisis à la suite, sans
// quitter le champ : Entrée ajoute, vide et garde le focus. Jouable seulement sur une base migrée (tables
// `shopping_*`) ; le clavier d'iOS ne se vérifie que sur un iPhone.
test.use({ locale: "fr-FR" });

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Nettoyage : chaque article de test est supprimé par le menu de sa ligne (tâche 15). La suppression part 5 s après
// le clic (« Annuler » ; un second « Supprimer » envoie la précédente tout de suite) : on attend la fin du délai de
// la dernière, puis on recharge pour vérifier qu'elles sont bien parties.
test.afterEach(async ({ page }) => {
  const labels = [...new Set(created.splice(0))];
  if (labels.length === 0) return;
  await page.goto("/lists/shopping");
  for (const label of labels) {
    // Un même libellé peut exister deux fois (scénario 2) : on supprime toutes les lignes.
    while ((await page.getByRole("checkbox", { name: label }).count()) > 0) {
      await removeRow(page, label);
    }
  }
  await expect(removedToast(page)).toBeHidden({ timeout: 10_000 });
  await page.reload();
  for (const label of labels) {
    await expect(page.getByRole("checkbox", { name: label })).toHaveCount(0);
  }
});

const removedToast = (page: Page) => page.getByTestId("removed-toast");

async function openItemMenu(page: Page, label: string) {
  await page
    .getByRole("button", {
      name: fr.shopping.itemMenu.trigger.replace("{label}", label),
    })
    .first()
    .click();
}

async function removeRow(page: Page, label: string) {
  const rows = page.getByRole("checkbox", { name: label });
  const before = await rows.count();
  await openItemMenu(page, label);
  await page
    .getByRole("menuitem", { name: fr.shopping.itemMenu.remove })
    .click();
  await expect(rows).toHaveCount(before - 1);
}

const field = (page: Page) =>
  page.getByRole("textbox", { name: fr.shopping.quickAdd.label });

test("ajout enchaîné de quatre articles, focus gardé", async ({ page }) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const input = field(page);
  await input.click();

  for (const base of ["Lait", "Pain", "Pommes", "Riz"]) {
    const label = uniqueTitle(base);
    created.push(label);
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(input).not.toHaveJSProperty("readOnly", true);
  }

  await page.reload();
  for (const label of created) {
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
  }
});

test("un champ vide n'ajoute rien", async ({ page }) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const input = field(page);
  const before = await page.getByRole("checkbox").count();
  await input.click();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(page.getByRole("checkbox")).toHaveCount(before);
});

// Scénario 3 : régler l'ordre du magasin. « Surgelés » glissé en tête par sa poignée, ordre gardé après un
// rechargement. Souris ici ; l'appui long au doigt (250 ms) ne se vérifie que sur un iPhone.
// raccourci: l'ordre des rayons est une préférence de l'utilisateur de test, non remise à l'état d'avant — elle
// ne gêne aucun autre scénario (seul l'ordre d'affichage change).
const aisleHeadings = (page: Page) => page.locator("h2[id^='shopping-aisle-']");
const aisleHandle = (page: Page, key: keyof typeof fr.shopping.aisles) =>
  page.getByRole("button", {
    name: fr.shopping.aisleSort.handle.replace(
      "{aisle}",
      fr.shopping.aisles[key],
    ),
  });

async function dragHandle(
  page: Page,
  key: keyof typeof fr.shopping.aisles,
  toward: "top" | "bottom",
) {
  const handleBox = await aisleHandle(page, key).boundingBox();
  const headings = aisleHeadings(page);
  const edge = await (
    toward === "top" ? headings.first() : headings.last()
  ).boundingBox();
  if (!handleBox || !edge) throw new Error("rayon introuvable à l'écran");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Plus de 4 px d'abord : le capteur souris s'active, puis le rayon suit jusqu'au bord visé.
  await page.mouse.move(startX, startY + (toward === "top" ? -8 : 8), {
    steps: 4,
  });
  await page.mouse.move(startX, toward === "top" ? edge.y - 10 : edge.y + 40, {
    steps: 12,
  });
  await page.mouse.up();
}

test("l'ordre des rayons glissé est gardé après rechargement", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  for (const base of ["Pommes", "Pizza surgelée"]) {
    const label = uniqueTitle(base);
    created.push(label);
    await field(page).click();
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
  }
  const frozen = fr.shopping.aisles.frozen;
  const names = async () => aisleHeadings(page).allTextContents();

  // Départ propre : « Surgelés » n'est pas déjà en tête (essai précédent).
  if ((await names())[0] === frozen) {
    await dragHandle(page, "frozen", "bottom");
    await expect.poll(async () => (await names())[0]).not.toBe(frozen);
  }

  await dragHandle(page, "frozen", "top");
  await expect.poll(async () => (await names())[0]).toBe(frozen);

  await page.reload();
  expect((await names())[0]).toBe(frozen);
});

// Scénario 2 : corriger un classement. Un article inconnu atterrit en Divers ; Antoine le passe dans « Épicerie
// salée » par le menu de sa ligne (feuille « Changer de rayon ») ; il le retape à l'identique : il atterrit en
// « Épicerie salée » (correction mémorisée par libellé normalisé complet).
const aisleSection = (page: Page, key: keyof typeof fr.shopping.aisles) =>
  page.getByRole("region", { name: fr.shopping.aisles[key] });

test("changer un article de rayon mémorise la correction", async ({ page }) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const label = uniqueTitle("Truc inconnu");
  created.push(label);
  const add = async () => {
    await field(page).click();
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
  };

  await add();
  await expect(
    aisleSection(page, "other").getByRole("checkbox", { name: label }),
  ).toBeVisible();

  await openItemMenu(page, label);
  await page
    .getByRole("menuitem", { name: fr.shopping.itemMenu.moveAisle })
    .click();
  const sheet = page.getByRole("dialog", { name: fr.shopping.moveAisle.title });
  await sheet
    .getByRole("button", { name: fr.shopping.aisles.pantrySavory })
    .click();
  await expect(sheet).toBeHidden();
  await expect(
    aisleSection(page, "pantrySavory").getByRole("checkbox", { name: label }),
  ).toBeVisible();

  // Retapé à l'identique : même rayon, sans nouvelle correction.
  await add();
  await expect(
    aisleSection(page, "pantrySavory").getByRole("checkbox", { name: label }),
  ).toHaveCount(2);
  await expect(
    aisleSection(page, "other").getByRole("checkbox", { name: label }),
  ).toHaveCount(0);
});

// « Vider les cochés » : la confirmation précède la suppression, puis seuls les cochés partent.
test("vider les cochés demande confirmation puis ne supprime que les cochés", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const done = uniqueTitle("Coché");
  const kept = uniqueTitle("Gardé");
  created.push(done, kept);
  for (const label of [done, kept]) {
    await field(page).click();
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
  }
  await page.getByRole("checkbox", { name: done }).click();
  await expect(page.getByRole("checkbox", { name: done })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await page.getByRole("button", { name: /^Vider les cochés/ }).click();
  const dialog = page.getByRole("dialog", {
    name: fr.shopping.clearChecked.title,
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("checkbox", { name: done })).toBeVisible();

  await dialog
    .getByRole("button", { name: fr.shopping.clearChecked.confirm })
    .click();
  await expect(page.getByRole("checkbox", { name: done })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: kept })).toBeVisible();
});
