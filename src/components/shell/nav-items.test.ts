// @vitest-environment node
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, TASKS_PATH } from "./nav-items";

describe("sections de la navigation", () => {
  it("place To-do juste avant Réglages, Réglages toujours en dernier", () => {
    const keys = NAV_ITEMS.map((item) => item.labelKey);

    expect(keys).toEqual(["home", "tasks", "settings"]);
    expect(NAV_ITEMS[1].href).toBe(TASKS_PATH);
  });
});
