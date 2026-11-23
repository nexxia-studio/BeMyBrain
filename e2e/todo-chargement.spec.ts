import { expect, type Page, type Route, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  detailDialog,
  idFromHref,
  quickAddTask,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Spec brain-50-veille-base, scénario 4 (BRAIN-54) : pendant le chargement de `/tasks`, un seul titre « To-do »
// et un seul givre de liste (le chargement de la liste n'enveloppe plus l'emplacement `@detail`). À l'ouverture
// d'un détail depuis la liste, aucun chargement : la liste reste affichée, sans givre ni titre en plus, jusqu'à
// l'arrivée du détail. Ordinateur (panneau) et mobile (tiroir).
//
// Chargement ralenti : `page.route` retient la requête RSC de la navigation côté client (même procédé que
// `effets-de-verre.spec.ts`) ; les préchargements passent, Next affiche au clic le `loading.tsx` déjà en cache.
// Doublons relevés dans la page (`watchPeaks`) : un `toHaveCount` qui réessaie laisserait passer un doublon bref.
test.use({ locale: "fr-FR" });
test.setTimeout(60_000);

const RSC_DELAY_MS = 2_000;
const TASK_PATH = /^\/tasks\/[0-9a-f-]{36}$/;

/** Retient la requête RSC de navigation vers les adresses visées ; laisse passer les préchargements. */
async function slowNavigation(
  page: Page,
  matches: (pathname: string) => boolean,
) {
  await page.route(
    (url) => matches(url.pathname),
    async (route: Route) => {
      const headers = route.request().headers();
      if (headers.rsc === "1" && !("next-router-prefetch" in headers)) {
        await new Promise((resolve) => setTimeout(resolve, RSC_DELAY_MS));
      }
      await route.continue();
    },
  );
}

type Peaks = { h1: number; main: number; tasksFrost: number };

/**
 * Relève dans la page, à chaque changement du DOM, le plus grand nombre de titres `h1`, de `main` et de givres
 * de liste. Un `toHaveCount` qui réessaie ne prouve pas qu'un doublon n'est jamais
 * apparu ; le maximum, si.
 */
async function watchPeaks(page: Page) {
  await page.evaluate(() => {
    const peaks = { h1: 0, main: 0, tasksFrost: 0 };
    const sample = () => {
      const count = (selector: string) =>
        document.querySelectorAll(selector).length;
      peaks.h1 = Math.max(peaks.h1, count("h1"));
      peaks.main = Math.max(peaks.main, count("main"));
      peaks.tasksFrost = Math.max(
        peaks.tasksFrost,
        count('[data-testid="tasks-frost"]'),
      );
    };
    sample();
    new MutationObserver(sample).observe(document.body, {
      childList: true,
      subtree: true,
    });
    (window as unknown as { __peaks: typeof peaks }).__peaks = peaks;
  });
}

async function peaks(page: Page): Promise<Peaks> {
  return page.evaluate(() => (window as unknown as { __peaks: Peaks }).__peaks);
}

const listTitle = (page: Page) =>
  page.getByRole("heading", { level: 1, name: fr.tasks.list.title });

test.describe("chargement de la to-do", () => {
  test("liste en chargement : un seul titre « To-do » et un seul givre de liste", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await slowNavigation(page, (pathname) => pathname === "/tasks");
    await watchPeaks(page);

    await page
      .getByRole("navigation", { name: fr.shell.navigation })
      .getByRole("link", { name: fr.shell.tasks, exact: true })
      .click();

    const frost = page.getByTestId("tasks-frost");
    await expect(frost.first()).toBeVisible();
    await expect(frost).toHaveCount(1);
    await expect(listTitle(page)).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);

    await expect(frost).toHaveCount(0, { timeout: 15_000 });
    await expect(listTitle(page)).toHaveCount(1);
    expect(await peaks(page)).toEqual({
      h1: 1,
      main: 1,
      tasksFrost: 1,
    });
  });

  test("détail en chargement : la liste reste seule, sans givre ni titre en plus", async ({
    page,
  }) => {
    const ids: string[] = [];
    try {
      await signIn(page);
      await page.goto("/tasks");
      const title = uniqueTitle("Chargement du détail");
      ids.push(await quickAddTask(page, title));
      const link = taskLink(page.getByRole("main"), title);
      await expect(link).toBeVisible();
      expect(idFromHref(await link.getAttribute("href"))).toBe(ids[0]);
      await page.waitForLoadState("networkidle");
      await slowNavigation(page, (pathname) => TASK_PATH.test(pathname));
      await watchPeaks(page);

      await link.click();

      // Pendant l'attente (2 s) : la liste reste affichée et utilisable.
      await expect(listTitle(page)).toBeVisible();
      await expect(page.getByTestId("tasks-frost")).toHaveCount(0);
      await expect(
        detailDialog(page).getByRole("textbox", {
          name: fr.tasks.detail.title,
        }),
      ).toHaveValue(title, { timeout: 15_000 });
      // Le dialogue modal masque la page aux rôles : décompte dans le DOM.
      expect(await peaks(page)).toEqual({ h1: 1, main: 1, tasksFrost: 0 });
    } finally {
      await trashTasks(page, ids);
    }
  });
});
