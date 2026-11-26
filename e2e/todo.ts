import { expect, type Locator, type Page } from "@playwright/test";
import { createTranslator } from "next-intl";

import fr from "../messages/fr.json";
import { getUserTimeZone, todayIn } from "../src/modules/core/time-zone";

// Aides des parcours de la to-do (spec todo-unifiee, scénarios 1 à 7), interface en français.
// Données isolées par test : chaque titre porte un suffixe unique, aucun parcours ne dépend d'un autre ni de
// l'ordre. Aucune suppression définitive n'existe : ce qu'un parcours crée est mis à la corbeille à la fin
// (`trashTasks`), pour que les listes et la tuile « Aujourd'hui » du compte e2e partagé restent courtes.

export const t = createTranslator({ locale: "fr", messages: fr });

/** Largeur à partir de laquelle la coque passe en mise en page ordinateur (barre latérale, panneau). */
const DESKTOP_MIN_WIDTH = 1024;

/** Titre unique pour ce test (contenu saisi, jamais traduit). */
export function uniqueTitle(base: string): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${base} ${suffix}`;
}

/** Jour `YYYY-MM-DD` de l'utilisateur, décalé de `offset` jours (même fuseau que l'app). */
export function userDay(offset = 0): string {
  const [year, month, day] = todayIn(getUserTimeZone(), new Date())
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset))
    .toISOString()
    .slice(0, 10);
}

export function isDesktop(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= DESKTOP_MIN_WIDTH;
}

/**
 * Bascule Privé / Pro de la coque. N'attend pas la fin de l'enregistrement : l'ajout rapide et la palette
 * prennent le côté affiché (optimiste), même avant le rendu serveur.
 */
export async function switchSide(page: Page, side: "private" | "pro") {
  const button = page
    .getByRole("group", { name: fr.shell.side.label })
    .getByRole("button", { name: fr.shell.side[side] });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

/**
 * Filtre d'espace du côté actif : liste de la barre latérale sur ordinateur, pastille de l'en-tête de page
 * sous 1024 px. N'attend pas la fin de l'enregistrement, comme `switchSide`.
 */
export async function filterContext(page: Page, name: string) {
  if (isDesktop(page)) {
    const button = page
      .getByRole("navigation", { name: fr.shell.navigation })
      .getByRole("group", { name: fr.shell.contexts.label })
      .getByRole("button", { name });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    return;
  }
  const trigger = page.getByRole("button", {
    name: new RegExp(`^${fr.shell.contexts.label}`),
  });
  await trigger.click();
  await page.getByRole("menuitemradio", { name }).click();
  await expect(trigger).toContainText(name);
}

/** Ouvre l'ajout rapide (« + » central sur mobile, bouton rond de l'en-tête sur ordinateur). */
export async function openQuickAdd(page: Page): Promise<Locator> {
  if (isDesktop(page)) {
    await page.getByRole("button", { name: fr.quickAdd.open }).click();
  } else {
    await page
      .getByRole("navigation", { name: fr.shell.navigation })
      .getByRole("button", { name: fr.quickAdd.open })
      .click();
  }
  const dialog = page.getByRole("dialog", {
    name: fr.quickAdd.types.task.title,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

export function quickAddTitle(dialog: Locator): Locator {
  return dialog.getByLabel(fr.tasks.quickAdd.title, { exact: true });
}

/**
 * Valide l'ajout rapide et attend « Tâche ajoutée » ; renvoie l'id de la tâche créée (lien « Ouvrir »).
 */
export async function submitQuickAdd(dialog: Locator): Promise<string> {
  await dialog
    .getByRole("button", { name: fr.tasks.quickAdd.submit, exact: true })
    .click();
  const status = dialog.getByTestId("quick-add-status");
  await expect(status).toContainText(fr.tasks.quickAdd.added);
  const href = await status
    .getByRole("link", { name: fr.tasks.quickAdd.open })
    .getAttribute("href");
  return idFromHref(href);
}

/** Échéance par le champ natif « Choisir… » de la pastille Date, heure facultative. */
export async function pickDueDate(
  page: Page,
  dialog: Locator,
  date: string,
  time?: string,
) {
  await dialog
    .getByRole("button", {
      name: new RegExp(
        `^${fr.tasks.quickAdd.date.quickMenuLabel.split(" :")[0]}`,
      ),
    })
    .click();
  await page.getByLabel(fr.tasks.quickAdd.date.pick).fill(date);
  if (time !== undefined) {
    await page
      .getByRole("button", { name: fr.tasks.quickAdd.date.addTime })
      .click();
    await page.getByLabel(fr.tasks.quickAdd.date.time).fill(time);
  }
  // Échap ferme la popup seule, pas l'ajout rapide.
  await page.keyboard.press("Escape");
  await expect(page.getByLabel(fr.tasks.quickAdd.date.pick)).toHaveCount(0);
  await expect(dialog).toBeVisible();
}

/** Crée une tâche par l'ajout rapide (titre et échéance facultative), puis le referme. */
export async function quickAddTask(
  page: Page,
  title: string,
  due?: { date: string; time?: string },
): Promise<string> {
  const dialog = await openQuickAdd(page);
  await quickAddTitle(dialog).fill(title);
  if (due !== undefined) await pickDueDate(page, dialog, due.date, due.time);
  const id = await submitQuickAdd(dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return id;
}

export function idFromHref(href: string | null): string {
  const id = href?.match(/\/tasks\/([0-9a-f-]{36})/)?.[1];
  if (id === undefined) throw new Error(`Lien de tâche inattendu : ${href}`);
  return id;
}

/** Lien de la ligne d'une tâche (titre), dans la liste ou une tuile. */
export function taskLink(scope: Page | Locator, title: string): Locator {
  return scope.getByRole("link", { name: title });
}

/** Case à cocher « Terminer « titre » ». */
export function completeBox(scope: Page | Locator, title: string): Locator {
  return scope.getByRole("checkbox", {
    name: t("tasks.list.complete", { title }),
  });
}

/** Section d'échéance de la liste (« En retard », « Aujourd'hui »…). */
export function listSection(
  page: Page,
  key: keyof typeof fr.tasks.list.sections,
): Locator {
  return page.getByRole("region", { name: fr.tasks.list.sections[key] });
}

/** Détail ouvert (tiroir sur mobile, panneau sur ordinateur). */
export function detailDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: fr.tasks.detail.label });
}

/**
 * Met chaque tâche à la corbeille par son détail (adresse directe) ; une tâche déjà à la corbeille (page 404)
 * est ignorée. Appelé en fin de parcours, même après un échec.
 * La page 404 arrive en HTTP 200 (rendu en flux, le layout part avant `notFound()`) : on lit la page, pas le
 * statut.
 */
export async function trashTasks(page: Page, ids: readonly string[]) {
  for (const id of ids) {
    await page.goto(`/tasks/${id}`);
    const detail = detailDialog(page);
    const missing = page.getByRole("heading", { level: 1, name: "404" });
    await expect(detail.or(missing)).toBeVisible();
    if (await missing.isVisible()) continue;
    await detail
      .getByRole("button", { name: fr.tasks.detail.trash, exact: true })
      .click();
    await expect(page.getByText(fr.tasks.detail.trashed)).toBeVisible();
  }
}

// Aides du tableau (spec todo-kanban, scénarios 1 à 5 et 7).

/** Préférences d'affichage du tableau, posées en cookies avant d'ouvrir `/tasks` (jamais par l'interface). */
export type BoardPreferences = {
  view?: "list" | "board";
  side?: "private" | "pro";
  subtasks?: boolean;
  hideDoneSubtasks?: boolean;
  canceledOpen?: boolean;
};

export async function setBoardPreferences(
  page: Page,
  {
    view = "board",
    side = "private",
    subtasks = true,
    hideDoneSubtasks = false,
    canceledOpen = false,
  }: BoardPreferences = {},
): Promise<void> {
  const url = new URL(page.url()).origin;
  const flag = (value: boolean) => (value ? "1" : "0");
  await page.context().addCookies(
    [
      ["bmb_tasks_view", view],
      ["bmb_side", side],
      ["bmb_board_subtasks", flag(subtasks)],
      ["bmb_board_hide_done_subtasks", flag(hideDoneSubtasks)],
      ["bmb_board_canceled_open", flag(canceledOpen)],
    ].map(([name, value]) => ({ name, value, url })),
  );
}

/** Colonne du tableau (une par catégorie de statut). */
export function boardColumn(page: Page, category: string): Locator {
  return page.locator(`[data-board-column="${category}"]`);
}

/** Carte du tableau, par l'identifiant de sa tâche (nœud déplaçable : rôle bouton, focus, glisser). */
export function boardCard(scope: Page | Locator, id: string): Locator {
  return scope.locator(`[data-board-card="${id}"]`);
}

/** Ouvre `/tasks` en vue Tableau et attend l'hydratation (dnd-kit monte sa région d'annonces côté client). */
export async function openBoard(page: Page, query = ""): Promise<void> {
  await page.goto(`/tasks${query}`);
  await expect(boardColumn(page, "unstarted")).toBeAttached();
  await expect(page.locator('[id^="DndLiveRegion-"]')).toBeAttached();
}

/** Priorité d'une tâche, par la pastille de son détail (adresse directe). */
export async function setTaskPriority(
  page: Page,
  id: string,
  level: "1" | "2" | "3" | "4",
): Promise<void> {
  await page.goto(`/tasks/${id}`);
  const detail = detailDialog(page);
  const label = fr.tasks.detail.priority.label;
  await detail.getByRole("button", { name: new RegExp(`^${label} :`) }).click();
  await page
    .getByRole("menuitemradio", { name: fr.tasks.detail.priority[level] })
    .click();
  await expect(
    detail.getByRole("button", {
      name: `${label} : ${fr.tasks.detail.priority[level]}`,
    }),
  ).toBeVisible();
}

/** Sous-tâche créée par la ligne d'ajout du détail de sa parente ; renvoie son identifiant. */
export async function addSubtask(
  page: Page,
  parentId: string,
  title: string,
): Promise<string> {
  if (!page.url().endsWith(`/tasks/${parentId}`)) {
    await page.goto(`/tasks/${parentId}`);
  }
  const detail = detailDialog(page);
  const field = detail.getByLabel(fr.tasks.detail.subtasks.add);
  await field.fill(title);
  await field.press("Enter");
  const link = detail.getByRole("link", { name: title });
  await expect(link).toBeVisible();
  return idFromHref(await link.getAttribute("href"));
}

/**
 * Restes d'un parcours interrompu : toute tâche active dont le titre commence par `prefix`, des deux côtés,
 * terminées et annulées comprises, est mise à la corbeille. Renvoie le nombre de tâches trouvées.
 */
export async function sweepTasks(page: Page, prefix: string): Promise<number> {
  const found = new Set<string>();
  for (const side of ["private", "pro"] as const) {
    await setBoardPreferences(page, { view: "list", side });
    await page.goto("/tasks?completed=1");
    await expect(
      page.getByRole("heading", { level: 1, name: fr.tasks.list.title }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    const links = page.getByRole("link", { name: new RegExp(`^${prefix} `) });
    for (const href of await links.evaluateAll((all) =>
      all.map((link) => link.getAttribute("href")),
    )) {
      found.add(idFromHref(href));
    }
  }
  await trashTasks(page, [...found]);
  return found.size;
}
