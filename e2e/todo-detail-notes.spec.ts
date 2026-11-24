import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  detailDialog,
  listSection,
  quickAddTask,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Détail d'une tâche sans notes (BRAIN-46, D9, correctif de relecture) : le champ « Notes », replié à
// l'ouverture, se déplie au focus et le reste. S'il se repliait au départ du champ, le bouton « Mettre à la
// corbeille », juste dessous, remonterait entre l'appui et le relâchement de la souris : le clic serait perdu.
// Ordinateur seulement, fenêtre assez haute pour que le panneau ne défile pas : c'est là que le bouton suit la
// hauteur du champ (sur mobile, le tiroir est calé en bas ; dans un panneau qui défile, le bas reste en place).
test.use({ locale: "fr-FR", viewport: { width: 1280, height: 1100 } });

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("@desktop notes vides focalisées, puis corbeille en un seul clic", async ({
  page,
}) => {
  const title = uniqueTitle("Ranger le garage");
  await signIn(page);
  created.push(await quickAddTask(page, title));
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), title).click();
  const detail = detailDialog(page);
  const notes = detail.getByLabel(fr.tasks.detail.notes, { exact: true });
  const trash = detail.getByRole("button", {
    name: fr.tasks.detail.trash,
    exact: true,
  });
  await expect(notes).toHaveAttribute("data-collapsed", "true");
  const collapsedHeight = (await notes.boundingBox())!.height;

  await notes.click();

  await expect(notes).toBeFocused();
  await expect(notes).toHaveAttribute("data-collapsed", "false");
  expect((await notes.boundingBox())!.height).toBeGreaterThan(collapsedHeight);

  await trash.click();

  await expect(page.getByText(fr.tasks.detail.trashed)).toBeVisible();
});
