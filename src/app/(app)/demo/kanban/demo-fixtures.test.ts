import { describe, expect, it } from "vitest";

import { DONE_VISIBLE } from "./demo-board";
import { demoBoard, demoTasks } from "./demo-fixtures";

const TODAY = "2026-11-24";

describe("tâches fictives de la démo du kanban", () => {
  it("remplit « À faire » d'une quinzaine de cartes, pour faire défiler la colonne", () => {
    const board = demoBoard(demoTasks(TODAY));

    expect(board.unstarted.length).toBeGreaterThanOrEqual(14);
  });

  it("met dans « Terminée » plus de cartes que la limite affichée", () => {
    const board = demoBoard(demoTasks(TODAY));

    expect(board.completed.length).toBeGreaterThan(DONE_VISIBLE);
  });

  it("donne des échéances en retard, aujourd'hui et plus tard, relatives au jour donné", () => {
    const dues = demoTasks(TODAY).map((task) => task.dueDate);

    expect(dues).toContain(TODAY);
    expect(dues.some((due) => due !== null && due < TODAY)).toBe(true);
    expect(dues.some((due) => due !== null && due > TODAY)).toBe(true);
  });

  it("marque quelques cartes « Bloquée » et en annule quelques-unes", () => {
    const tasks = demoTasks(TODAY);

    expect(tasks.filter((task) => task.blocked).length).toBeGreaterThan(1);
    expect(demoBoard(tasks).canceled.length).toBeGreaterThan(0);
  });

  it("donne à chaque carte un id unique", () => {
    const ids = demoTasks(TODAY).map((task) => task.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
