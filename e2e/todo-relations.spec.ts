import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  completeBox,
  detailDialog,
  expectPickerInView,
  idFromHref,
  listSection,
  quickAddTask,
  takeQuickAdded,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénarios 9 et 10 de la spec todo-kanban (relations). 9 : « Bloquée par » ajouté depuis le détail, la ligne de
// liste porte « Bloquée », la relation apparaît inversée (« Bloque ») chez l'autre tâche, terminer la bloquante
// retire la pastille. 10 : une tâche reliée mise à la corbeille disparaît des relations et de la liste de
// sélection, restaurée elle revient. Le 9 tourne dans les deux projets, le 10 sur ordinateur seulement.
test.use({ locale: "fr-FR" });
test.setTimeout(90_000);

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Tout ce que le parcours a créé finit à la corbeille, échec compris (voir `todo-parente.spec.ts`).
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

const relations = fr.tasks.detail.relations;

async function openFromList(page: Page, title: string): Promise<Locator> {
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), title).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();
  return detail;
}

/** Ajoute une relation par la ligne d'ajout : type, recherche par titre, choix. */
async function addRelation(
  detail: Locator,
  kind: "blocks" | "blockedBy" | "related",
  other: string,
) {
  await detail
    .getByRole("button", { name: relations.add, exact: true })
    .click();
  await detail
    .getByRole("group", { name: relations.kindPrompt })
    .getByRole("button", { name: relations[kind], exact: true })
    .click();
  const search = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await expect(search).toBeFocused();
  await search.fill(other);
  await detail.getByRole("option", { name: other }).click();
  await expect(taskLink(detail, other)).toBeVisible();
}

test("scénario 9 : bloquer une tâche, pastille « Bloquée », relation inversée, terminer la bloquante", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const blocked = uniqueTitle("Livrer le site");
  const blocker = uniqueTitle("Valider le devis");
  await signIn(page);
  created.push(await quickAddTask(page, blocked));
  created.push(await quickAddTask(page, blocker));

  let detail = await openFromList(page, blocked);
  // Section vide : aucun groupe, seulement la ligne d'ajout.
  await expect(detail.getByRole("heading", { level: 3 })).toHaveCount(0);
  await addRelation(detail, "blockedBy", blocker);
  await expect(
    detail.getByRole("heading", { level: 3, name: relations.blockedBy }),
  ).toBeVisible();

  await page.goto("/tasks");
  await expect(
    listSection(page, "none")
      .getByRole("link", { name: blocked })
      .getByText(fr.tasks.blocked, { exact: true }),
  ).toBeVisible();
  await expect(
    listSection(page, "none")
      .getByRole("link", { name: blocker })
      .getByText(fr.tasks.blocked, { exact: true }),
  ).toHaveCount(0);

  // Chez la bloquante, la même relation se lit « Bloque ».
  await taskLink(listSection(page, "none"), blocker).click();
  detail = detailDialog(page);
  await expect(
    detail.getByRole("heading", { level: 3, name: relations.blocks }),
  ).toBeVisible();
  await expect(taskLink(detail, blocked)).toBeVisible();

  // Terminer la bloquante : la pastille disparaît de la ligne bloquée.
  await page.goto("/tasks");
  await completeBox(listSection(page, "none"), blocker).click();
  await expect(completeBox(listSection(page, "none"), blocker)).toHaveCount(0);
  await page.reload();
  await expect(taskLink(listSection(page, "none"), blocked)).toBeVisible();
  await expect(
    taskLink(listSection(page, "none"), blocked).getByText(fr.tasks.blocked, {
      exact: true,
    }),
  ).toHaveCount(0);

  // Retirer : la relation disparaît des deux côtés.
  detail = await openFromList(page, blocked);
  await detail
    .getByRole("button", {
      name: relations.removeLabel.replace("{title}", blocker),
    })
    .click();
  await expect(taskLink(detail, blocker)).toHaveCount(0);
  expect(violations).toEqual([]);
});

test("la liste de sélection d'une relation s'ouvre entièrement dans la fenêtre, retirer est un bouton texte", async ({
  page,
}) => {
  const main = uniqueTitle("Livrer le site");
  const other = uniqueTitle("Valider le devis");
  await signIn(page);
  created.push(await quickAddTask(page, main));
  created.push(await quickAddTask(page, other));
  const detail = await openFromList(page, main);

  await detail
    .getByRole("button", { name: relations.add, exact: true })
    .click();
  await detail
    .getByRole("group", { name: relations.kindPrompt })
    .getByRole("button", { name: relations.related, exact: true })
    .click();
  await expect(
    detail.getByRole("combobox", { name: fr.tasks.picker.label }),
  ).toBeFocused();
  await expectPickerInView(page, detail);

  await detail.getByRole("option", { name: other }).click();
  const remove = detail.getByRole("button", {
    name: relations.removeLabel.replace("{title}", other),
  });
  await expect(remove).toBeVisible();
  await expect(remove).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect((await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("Échap ferme la liste de sélection, le détail reste ouvert, le focus revient au bouton d'ajout", async ({
  page,
}) => {
  const title = uniqueTitle("Livrer le site");
  await signIn(page);
  created.push(await quickAddTask(page, title));
  const detail = await openFromList(page, title);
  const add = detail.getByRole("button", { name: relations.add, exact: true });

  await add.click();
  await detail
    .getByRole("group", { name: relations.kindPrompt })
    .getByRole("button", { name: relations.related, exact: true })
    .click();
  const search = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await expect(search).toBeFocused();
  await search.press("Escape");

  await expect(search).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(add).toBeFocused();

  // Au stade du choix du type, Échap ferme l'ajout sans fermer le détail.
  await add.click();
  const kinds = detail.getByRole("group", { name: relations.kindPrompt });
  await kinds.getByRole("button", { name: relations.related }).focus();
  await page.keyboard.press("Escape");
  await expect(kinds).toHaveCount(0);
  await expect(detail).toBeVisible();
  await expect(add).toBeFocused();
});

test("@desktop scénario 10 : une tâche reliée à la corbeille disparaît des relations et de la liste de sélection, restaurée elle revient", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const main = uniqueTitle("Préparer l'atelier");
  const other = uniqueTitle("Réserver la salle");
  await signIn(page);
  created.push(await quickAddTask(page, main));
  const otherId = await quickAddTask(page, other);
  created.push(otherId);

  let detail = await openFromList(page, main);
  await addRelation(detail, "related", other);
  const otherHref = await taskLink(detail, other).getAttribute("href");
  expect(idFromHref(otherHref)).toBe(otherId);

  await trashTasks(page, [otherId]);

  detail = await openFromList(page, main);
  await expect(taskLink(detail, other)).toHaveCount(0);
  await detail
    .getByRole("button", { name: relations.add, exact: true })
    .click();
  await detail
    .getByRole("group", { name: relations.kindPrompt })
    .getByRole("button", { name: relations.blocks, exact: true })
    .click();
  const search = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await search.fill(other);
  await expect(detail.getByText(fr.tasks.picker.empty)).toBeVisible();
  await expect(detail.getByRole("option", { name: other })).toHaveCount(0);

  await page.goto("/trash");
  await page
    .getByRole("listitem")
    .filter({ hasText: other })
    .getByRole("button", { name: fr.trash.restore, exact: true })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: other }),
  ).toHaveCount(0);

  detail = await openFromList(page, main);
  await expect(taskLink(detail, other)).toBeVisible();
  expect(violations).toEqual([]);
});
