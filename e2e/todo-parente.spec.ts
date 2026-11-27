import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  boardCard,
  detailDialog,
  expectLabelOnChip,
  expectPickerInView,
  listSection,
  openBoard,
  quickAddTask,
  setBoardPreferences,
  switchSide,
  takeQuickAdded,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 8 de la spec todo-kanban (transformer en sous-tâche), sans l'espace : choisir une parente dans la
// liste de sélection du détail, voir son lien et « Détacher » (une seule mention de la parente), changer de
// parente, refus d'une tâche qui a des sous-tâches (propriété désactivée avec sa raison). La liste ne montre
// jamais une tâche de l'autre côté. Tourne dans les deux projets. L'espace hérité de la parente est vérifié sur la
// carte avec l'espace Trustup du compte e2e (côté Pro) ; la perte d'espace sous une parente sans espace est
// prouvée par les tests du module (`mutations-parent.test.ts`).
test.use({ locale: "fr-FR" });
test.setTimeout(90_000);

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  takeQuickAdded(); // repart d'une liste propre à ce test
});

// Tout ce que le parcours a créé finit à la corbeille, échec compris (`takeQuickAdded` : les tâches créées avant
// qu'un échec ne les ait notées dans `created`) : l'espace Trustup du compte e2e doit rester vide (`effets-de-verre`).
test.afterEach(async ({ page }) => {
  await trashTasks(page, [...created.splice(0), ...takeQuickAdded()]);
});

// 390×844 sur mobile, 1280×800 sur ordinateur : la géométrie du détail se vérifie à ces deux fenêtres.
test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === "mobile"
      ? { width: 390, height: 844 }
      : { width: 1280, height: 800 },
  );
});

const parentLabel = (detail: Locator) =>
  detail.getByText(fr.tasks.detail.parentField.label, { exact: true });

const propertyField = (page: Page) =>
  detailDialog(page).getByRole("button", {
    name: `${fr.tasks.detail.parentField.label} : ${fr.tasks.detail.parentField.none}`,
  });

/** Donne un espace à une tâche Pro sans espace, par le détail (pastille « Espace »). */
async function setSpace(page: Page, title: string, space: string) {
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), title).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", {
      name: fr.tasks.quickAdd.context.menuLabel.replace(
        "{current}",
        fr.tasks.quickAdd.context.none,
      ),
    })
    .click();
  await page.getByRole("menuitemradio", { name: space }).click();
  await expect(
    detail.getByRole("button", {
      name: fr.tasks.quickAdd.context.menuLabel.replace("{current}", space),
    }),
  ).toBeVisible();
}

/** Carte du tableau (vue Pro) d'une tâche : la liste cache une sous-tâche sans échéance, le tableau non. */
async function boardRow(page: Page, id: string): Promise<Locator> {
  await page.goto("/tasks");
  await setBoardPreferences(page, { view: "board", side: "pro" });
  await openBoard(page);
  const card = boardCard(page, id);
  await expect(card).toBeAttached();
  return card;
}

const SPACE = "Trustup";

test("scénario 8 : rattacher, une seule mention, espace et légende sur la carte, changer, détacher ; l'autre côté n'est pas proposé", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const child = uniqueTitle("Écrire la proposition");
  const first = uniqueTitle("Dossier Nexxia");
  const second = uniqueTitle("Dossier Atelier");
  const privateTitle = uniqueTitle("Dossier perso");
  await signIn(page);
  await page.goto("/tasks");
  await switchSide(page, "private");
  created.push(await quickAddTask(page, privateTitle));
  await switchSide(page, "pro");
  const childId = await quickAddTask(page, child);
  created.push(childId);
  created.push(await quickAddTask(page, first));
  created.push(await quickAddTask(page, second));
  // `first` est dans l'espace Trustup ; `second` et `child` n'en ont pas.
  await setSpace(page, first, SPACE);
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), child).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();

  // Libellé à la hauteur de sa pastille, avant comme pendant l'ouverture de la liste.
  await expectLabelOnChip(parentLabel(detail), propertyField(page));
  await propertyField(page).click();

  const search = detail.getByRole("combobox", {
    name: fr.tasks.picker.label,
  });
  await expect(search).toBeFocused();
  await expectLabelOnChip(parentLabel(detail), propertyField(page));
  await expectPickerInView(page, detail);
  await search.fill("Dossier");
  await expect(detail.getByRole("option", { name: first })).toBeVisible();
  await expect(detail.getByRole("option", { name: second })).toBeVisible();
  await expect(detail.getByRole("option", { name: privateTitle })).toHaveCount(
    0,
  );
  await expect(detail.getByRole("option", { name: child })).toHaveCount(0);

  await detail.getByRole("option", { name: second }).click();

  // Une seule mention : le lien de la propriété, aucune ligne « Côté et espace » (elle suit la parente).
  await expect(
    detail.getByRole("link", { name: new RegExp(second) }),
  ).toHaveCount(1);
  const legend = detail.getByText(fr.tasks.detail.parentField.followsParent);
  await expect(legend).toBeVisible();
  await expect(
    detail.getByText(fr.tasks.detail.placement, { exact: true }),
  ).toHaveCount(0);
  // Une seule ligne de propriété : le lien est la valeur, à la hauteur de son libellé, la légende dessous,
  // dans la même colonne.
  const link = detail.getByRole("link", { name: new RegExp(second) });
  const [linkBox, legendBox] = await Promise.all([
    link.boundingBox(),
    legend.boundingBox(),
  ]);
  expect(legendBox!.y).toBeGreaterThan(linkBox!.y + linkBox!.height - 1);
  expect(Math.abs(legendBox!.x - linkBox!.x)).toBeLessThanOrEqual(1);
  await expectLabelOnChip(parentLabel(detail), link);
  // Le focus reste dans le champ : il passe à « Changer » (le bouton « Aucune » a disparu).
  const change = detail.getByRole("button", {
    name: fr.tasks.detail.parentField.change,
    exact: true,
  });
  await expect(change).toBeFocused();

  // Carte : légende de la parente, pas d'espace (la parente n'en a pas).
  let row = await boardRow(page, childId);
  await expect(row).toContainText(second);
  await expect(row).not.toContainText(SPACE);

  // Changer de parente : une seule écriture, l'ancienne n'est plus proposée ; la carte prend l'espace.
  await page.goto(`/tasks/${childId}`);
  await expect(detail).toBeVisible();
  await change.click();
  const again = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await again.fill("Dossier");
  await expect(detail.getByRole("option", { name: second })).toHaveCount(0);
  await detail.getByRole("option", { name: first }).click();
  await expect(
    detail.getByRole("link", { name: new RegExp(first) }),
  ).toHaveCount(1);
  await expect(
    detail.getByRole("link", { name: new RegExp(second) }),
  ).toHaveCount(0);
  await expect(change).toBeFocused();

  row = await boardRow(page, childId);
  await expect(row).toContainText(first);
  await expect(row).toContainText(SPACE);

  // Détacher : la légende disparaît, la tâche garde côté et espace, le focus passe à « Aucune ».
  await page.goto(`/tasks/${childId}`);
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", {
      name: fr.tasks.detail.parentField.detach,
      exact: true,
    })
    .click();

  await expect(propertyField(page)).toBeVisible();
  await expect(propertyField(page)).toBeFocused();
  await expect(
    detail.getByText(fr.tasks.detail.placement, { exact: true }),
  ).toBeVisible();
  row = await boardRow(page, childId);
  await expect(row).not.toContainText(first);
  await expect(row).toContainText(SPACE);
  expect(violations).toEqual([]);
});

test("Échap ferme la liste de sélection, le détail reste ouvert, le focus revient au déclencheur", async ({
  page,
}) => {
  const child = uniqueTitle("Écrire la proposition");
  await signIn(page);
  created.push(await quickAddTask(page, child));
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), child).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();

  await propertyField(page).click();
  const search = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await expect(search).toBeFocused();
  await search.press("Escape");

  await expect(search).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(propertyField(page)).toBeFocused();
});

test("une tâche qui a des sous-tâches : propriété désactivée avec sa raison", async ({
  page,
}) => {
  const parent = uniqueTitle("Préparer l'atelier");
  const sub = uniqueTitle("Réserver la salle");
  await signIn(page);
  created.push(await quickAddTask(page, parent));
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), parent).click();
  const detail = detailDialog(page);
  const field = detail.getByLabel(fr.tasks.detail.subtasks.add);
  await field.fill(sub);
  await field.press("Enter");
  await expect(taskLink(detail, sub)).toBeVisible();
  created.push(
    (await taskLink(detail, sub).getAttribute("href"))!
      .split("/")
      .pop()!
      .split("?")[0],
  );

  // Même forme que les autres propriétés : pastille « Aucune » désactivée, raison en légende.
  const reason = detail.getByText(fr.tasks.detail.parentField.hasSubtasks);
  await expect(reason).toBeVisible();
  await expect(propertyField(page)).toHaveAttribute("aria-disabled", "true");
  await expect(propertyField(page)).toHaveCSS("opacity", "0.6");
  await expect(propertyField(page)).toHaveCSS("cursor", "not-allowed");
  await expectLabelOnChip(parentLabel(detail), propertyField(page));
  // Au clavier aussi : Entrée sur la pastille désactivée n'ouvre rien.
  await propertyField(page).focus();
  await page.keyboard.press("Enter");
  await propertyField(page).click({ force: true });
  await expect(
    detail.getByRole("combobox", { name: fr.tasks.picker.label }),
  ).toHaveCount(0);
});
