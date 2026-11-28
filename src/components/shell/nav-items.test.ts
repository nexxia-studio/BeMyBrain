// @vitest-environment node
import { describe, expect, it } from "vitest";

import { LISTS_PATH, NAV_ITEMS, navItemsFor, TASKS_PATH } from "./nav-items";

describe("sections de la navigation", () => {
  it("place Listes après To-do, Réglages toujours en dernier", () => {
    const keys = NAV_ITEMS.map((item) => item.labelKey);

    expect(keys).toEqual(["home", "tasks", "lists", "settings"]);
    expect(NAV_ITEMS[1].href).toBe(TASKS_PATH);
    expect(NAV_ITEMS[2].href).toBe(LISTS_PATH);
  });

  it("l'onglet Listes est présent côté Privé et absent côté Pro", () => {
    expect(navItemsFor("private").map((i) => i.href)).toContain(LISTS_PATH);
    expect(navItemsFor("pro").map((i) => i.href)).not.toContain(LISTS_PATH);
  });

  it("les autres sections restent des deux côtés", () => {
    expect(navItemsFor("pro").map((i) => i.labelKey)).toEqual([
      "home",
      "tasks",
      "settings",
    ]);
  });
});
