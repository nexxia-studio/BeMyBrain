import { expect, type Page, test } from "@playwright/test";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import { idFromHref, trashTasks, uniqueTitle } from "./todo";

// Scénario 7 de la spec todo-unifiee (langue) : en anglais, l'ajout rapide, la liste, le détail, la corbeille
// et les tuiles sont entièrement en anglais ; les titres saisis restent tels quels.
// Modifie la langue du compte e2e partagé : tourne dans le projet Playwright « langue » (seul, en série, après
// les autres, à 1440 px) et remet le compte en français à la fin, même après un échec.
// « Entièrement en anglais » : aucun texte d'interface français (valeur de messages/fr.json qui diffère de
// l'anglais) dans le texte affiché, contenu saisi retiré (titre du parcours, noms des espaces).
test.use({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });
// Passage en anglais, cinq écrans, retour en français et rangement : au-delà des 30 s par défaut.
test.setTimeout(90_000);

// Noms des espaces du compte e2e (contenu saisi, jamais traduit) : « Privé » est aussi un texte d'interface.
const CONTEXT_NAMES = ["Privé", "Trustup", "Nexxia"];
const SECTIONS = ["tasks", "trash", "quickAdd", "dashboard", "shell"] as const;

/** Textes d'interface français des écrans de la to-do qui diffèrent de leur traduction anglaise. */
function frenchOnlyTexts(): string[] {
  const texts: string[] = [];
  const walk = (frValue: unknown, enValue: unknown) => {
    if (typeof frValue === "string") {
      if (frValue !== enValue && frValue.length >= 4 && !/[{<]/.test(frValue)) {
        texts.push(frValue);
      }
      return;
    }
    if (typeof frValue === "object" && frValue !== null) {
      for (const [key, value] of Object.entries(frValue)) {
        walk(value, (enValue as Record<string, unknown> | undefined)?.[key]);
      }
    }
  };
  for (const section of SECTIONS) walk(fr[section], en[section]);
  return texts;
}

const FRENCH_ONLY = frenchOnlyTexts();

/** Textes français trouvés dans la page, contenu saisi (`typed`) retiré. */
async function frenchLeftovers(
  page: Page,
  typed: string[],
  // Corbeille : elle garde les tâches de tous les autres parcours, dont les titres contiennent des mots de
  // l'interface (« Annuler », « Terminée ») ; on ne lit que la ligne de la tâche de ce test.
  onlyRowOf?: string,
) {
  let text = await page.locator("body").evaluate((body, keep) => {
    if (keep === undefined) return (body as HTMLElement).innerText;
    const copy = body.cloneNode(true) as HTMLElement;
    // `textContent` lit aussi les scripts (flux RSC : tous les titres, tous les messages).
    copy.querySelectorAll("script, style").forEach((node) => node.remove());
    for (const li of copy.querySelectorAll("main li")) {
      if (!li.textContent?.includes(keep)) li.remove();
    }
    return copy.textContent ?? "";
  }, onlyRowOf);
  for (const value of [...typed, ...CONTEXT_NAMES]) {
    text = text.replaceAll(value, "");
  }
  return FRENCH_ONLY.filter((value) => text.includes(value));
}

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Remet le compte de test en français, même après un échec : les autres parcours l'attendent. Puis range.
test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await signIn(page);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: fr.settings.language.fr })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await trashTasks(page, created.splice(0));
});

test("en anglais, ajout rapide, liste, détail, corbeille et tuiles sont en anglais, le titre saisi reste tel quel", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const title = uniqueTitle("Relancer le devis");
  await signIn(page);
  await page.goto("/settings");
  await page
    .getByRole("group", { name: fr.settings.language.title })
    .getByRole("button", { name: fr.settings.language.en })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/dashboard");

  // Ajout rapide, popup des dates ouverte.
  await page.getByRole("button", { name: en.quickAdd.open }).click();
  const dialog = page.getByRole("dialog", {
    name: en.quickAdd.types.task.title,
  });
  await dialog.getByLabel(en.tasks.quickAdd.title, { exact: true }).fill(title);
  await dialog
    .getByRole("button", {
      name: new RegExp(
        `^${en.tasks.quickAdd.date.quickMenuLabel.split(":")[0]}`,
      ),
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: new RegExp(`^${en.tasks.quickAdd.date.tomorrow}`),
    }),
  ).toBeVisible();
  expect(await frenchLeftovers(page, [title])).toEqual([]);
  await page
    .getByRole("button", {
      name: new RegExp(`^${en.tasks.quickAdd.date.today}`),
    })
    .click();
  await dialog
    .getByRole("button", { name: en.tasks.quickAdd.submit, exact: true })
    .click();
  const status = dialog.getByTestId("quick-add-status");
  await expect(status).toContainText(en.tasks.quickAdd.added);
  created.push(
    idFromHref(
      await status
        .getByRole("link", { name: en.tasks.quickAdd.open })
        .getAttribute("href"),
    ),
  );
  expect(await frenchLeftovers(page, [title])).toEqual([]);
  await page.keyboard.press("Escape");

  // Tuiles.
  await page.goto("/dashboard");
  await expect(
    page
      .getByTestId("tile-today")
      .getByRole("list", { name: en.dashboard.today.list })
      .getByRole("link", { name: title }),
  ).toContainText(en.shell.side.private);
  expect(await frenchLeftovers(page, [title])).toEqual([]);

  // Liste, puis détail.
  await page.goto("/tasks");
  const today = page.getByRole("region", {
    name: en.tasks.list.sections.today,
  });
  await expect(today.getByRole("link", { name: title })).toBeVisible();
  expect(await frenchLeftovers(page, [title])).toEqual([]);
  await today.getByRole("link", { name: title }).click();
  const detail = page.getByRole("dialog", { name: en.tasks.detail.label });
  await expect(detail.getByLabel(en.tasks.detail.title)).toHaveValue(title);
  expect(await frenchLeftovers(page, [title])).toEqual([]);

  // Corbeille.
  await detail
    .getByRole("button", { name: en.tasks.detail.trash, exact: true })
    .click();
  await expect(page.getByText(en.tasks.detail.trashed)).toBeVisible();
  await page.goto("/trash");
  await expect(page.getByText(title)).toBeVisible();
  expect(await frenchLeftovers(page, [title], title)).toEqual([]);
  expect(violations).toEqual([]);
});
