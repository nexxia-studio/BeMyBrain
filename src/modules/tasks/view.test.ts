import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTask } from "../../../tests/factories/build-task";

import {
  dateShortcuts,
  groupBySection,
  sideTileItems,
  subtaskCounter,
  todayTileItems,
} from "./view";

// Jeudi 2026-11-19.
const today = "2026-11-19";

function ids(tasks: { id: string }[]): string[] {
  return tasks.map((t) => t.id);
}

describe("groupBySection", () => {
  it("range par échéance : en retard, aujourd'hui, demain, plus tard, sans échéance", () => {
    const none = buildTask();
    const later = buildTask({ dueDate: "2026-12-01" });
    const tomorrow = buildTask({ dueDate: "2026-11-20" });
    const due = buildTask({ dueDate: today });
    const overdue = buildTask({ dueDate: "2026-11-18" });

    const sections = groupBySection(
      [none, later, tomorrow, due, overdue],
      today,
    );

    expect(sections.map((s) => [s.key, ids(s.tasks)])).toEqual([
      ["overdue", [overdue.id]],
      ["today", [due.id]],
      ["tomorrow", [tomorrow.id]],
      ["later", [later.id]],
      ["none", [none.id]],
    ]);
  });

  it("omet les sections vides", () => {
    const due = buildTask({ dueDate: today });

    const sections = groupBySection([due], today);

    expect(sections.map((s) => s.key)).toEqual(["today"]);
  });

  it("sous-tâche sans échéance absente de toutes les sections", () => {
    const parent = buildTask({ subtaskTotal: 1 });
    const sub = buildTask({ parentId: parent.id, parentTitle: parent.title });

    const sections = groupBySection([parent, sub], today);

    expect(sections.flatMap((s) => ids(s.tasks))).toEqual([parent.id]);
  });

  it("sous-tâche avec échéance dans la section de son échéance, titre de la parente gardé", () => {
    const parent = buildTask({ title: "Déménagement" });
    const sub = buildTask({
      parentId: parent.id,
      parentTitle: "Déménagement",
      dueDate: "2026-11-20",
    });

    const sections = groupBySection([parent, sub], today);

    const tomorrow = sections.find((s) => s.key === "tomorrow");
    expect(tomorrow?.tasks).toEqual([sub]);
    expect(tomorrow?.tasks[0]?.parentTitle).toBe("Déménagement");
  });

  it("dans une section : priorité (aucune en dernier) puis date de création", () => {
    const none = buildTask({ dueDate: "2026-12-01", priority: 0 });
    const lowOld = buildTask({
      dueDate: "2026-11-25",
      priority: 4,
      createdAt: new Date("2026-11-01T08:00:00Z"),
    });
    const urgent = buildTask({ dueDate: "2026-12-10", priority: 1 });
    const lowNew = buildTask({
      dueDate: "2026-11-22",
      priority: 4,
      createdAt: new Date("2026-11-02T08:00:00Z"),
    });

    const sections = groupBySection([none, lowNew, urgent, lowOld], today);

    expect(ids(sections[0]?.tasks ?? [])).toEqual([
      urgent.id,
      lowOld.id,
      lowNew.id,
      none.id,
    ]);
  });

  it("terminées en dernière section, par date de fin décroissante", () => {
    const open = buildTask({ dueDate: "2026-11-10" });
    const doneOld = buildTask({
      dueDate: "2026-11-10",
      statusCategory: "completed",
      completedAt: new Date("2026-11-11T08:00:00Z"),
    });
    const doneNew = buildTask({
      statusCategory: "completed",
      completedAt: new Date("2026-11-15T08:00:00Z"),
    });

    const sections = groupBySection([doneOld, open, doneNew], today);

    expect(sections.map((s) => [s.key, ids(s.tasks)])).toEqual([
      ["overdue", [open.id]],
      ["completed", [doneNew.id, doneOld.id]],
    ]);
  });

  it("annulée dans la section des terminées, triée avec elles par date de fin", () => {
    const doneOld = buildTask({
      statusCategory: "completed",
      completedAt: new Date("2026-11-11T08:00:00Z"),
    });
    const canceled = buildTask({
      statusCategory: "canceled",
      completedAt: new Date("2026-11-13T08:00:00Z"),
    });
    const doneNew = buildTask({
      statusCategory: "completed",
      completedAt: new Date("2026-11-15T08:00:00Z"),
    });

    const sections = groupBySection([doneOld, canceled, doneNew], today);

    expect(sections.map((s) => [s.key, ids(s.tasks)])).toEqual([
      ["completed", [doneNew.id, canceled.id, doneOld.id]],
    ]);
  });
});

describe("subtaskCounter", () => {
  it("formate terminées / comptées", () => {
    const task = buildTask({ subtaskDone: 1, subtaskTotal: 3 });

    expect(subtaskCounter(task)).toBe("1/3");
  });

  it("rien quand aucune sous-tâche n'est comptée", () => {
    const task = buildTask({ subtaskDone: 0, subtaskTotal: 0 });

    expect(subtaskCounter(task)).toBeNull();
  });
});

describe("todayTileItems", () => {
  it("compte en retard et aujourd'hui, garde les 3 premières des deux côtés", () => {
    const tasks = [
      buildTask({ side: "pro", dueDate: today, dueTime: "14:00" }),
      buildTask({ side: "private", dueDate: "2026-11-18" }),
      buildTask({ side: "pro", dueDate: today }),
      buildTask({ side: "private", dueDate: "2026-11-17" }),
      buildTask({ side: "pro", dueDate: today, dueTime: "09:00" }),
    ];

    const tile = todayTileItems(tasks, today);

    expect(tile.overdueCount).toBe(2);
    expect(tile.todayCount).toBe(3);
    expect(ids(tile.items)).toEqual([tasks[3]!.id, tasks[1]!.id, tasks[4]!.id]);
    expect(tile.items.map((t) => t.side)).toEqual([
      "private",
      "private",
      "pro",
    ]);
  });

  it("écarte les tâches dues demain et les tâches fermées", () => {
    const due = buildTask({ dueDate: today });
    const tomorrow = buildTask({ dueDate: "2026-11-20" });
    const done = buildTask({ dueDate: today, statusCategory: "completed" });
    const canceled = buildTask({ dueDate: today, statusCategory: "canceled" });

    const tile = todayTileItems([due, tomorrow, done, canceled], today);

    expect(tile.todayCount).toBe(1);
    expect(ids(tile.items)).toEqual([due.id]);
  });

  it("une sous-tâche due aujourd'hui compte et garde le titre de sa parente", () => {
    const sub = buildTask({
      parentId: "00000000-0000-4000-8000-999999999999",
      parentTitle: "Déménagement",
      dueDate: today,
    });

    const tile = todayTileItems([sub], today);

    expect(tile.todayCount).toBe(1);
    expect(tile.items[0]?.parentTitle).toBe("Déménagement");
  });
});

describe("sideTileItems", () => {
  it("5 prochaines tâches ouvertes du côté, par échéance", () => {
    const pro = [
      buildTask({ side: "pro" }),
      buildTask({ side: "pro", dueDate: "2026-11-25" }),
      buildTask({ side: "pro", dueDate: "2026-11-21" }),
      buildTask({ side: "pro", dueDate: "2026-11-22" }),
      buildTask({ side: "pro", dueDate: "2026-11-23" }),
      buildTask({ side: "pro", dueDate: "2026-11-24" }),
    ];
    const privateTask = buildTask({ side: "private", dueDate: "2026-11-20" });
    const done = buildTask({
      side: "pro",
      dueDate: "2026-11-20",
      statusCategory: "completed",
    });

    const items = sideTileItems([...pro, privateTask, done], "pro");

    expect(ids(items)).toEqual(
      ids([pro[2]!, pro[3]!, pro[4]!, pro[5]!, pro[1]!]),
    );
  });

  it("sous-tâche sans échéance absente, avec échéance présente", () => {
    const parent = buildTask({ side: "pro" });
    const bare = buildTask({ side: "pro", parentId: parent.id });
    const dated = buildTask({
      side: "pro",
      parentId: parent.id,
      dueDate: "2026-11-20",
    });

    const items = sideTileItems([parent, bare, dated], "pro");

    expect(ids(items)).toEqual([dated.id, parent.id]);
  });
});

describe("dateShortcuts", () => {
  it("un jeudi : demain vendredi, ce week-end samedi, semaine prochaine lundi", () => {
    expect(dateShortcuts("2026-11-19")).toEqual({
      today: "2026-11-19",
      tomorrow: "2026-11-20",
      weekend: "2026-11-21",
      nextWeek: "2026-11-23",
    });
  });

  it("ce week-end un samedi = aujourd'hui", () => {
    expect(dateShortcuts("2026-11-21").weekend).toBe("2026-11-21");
  });

  it("un dimanche : ce week-end = samedi suivant, semaine prochaine = le lendemain", () => {
    const shortcuts = dateShortcuts("2026-11-22");

    expect(shortcuts.weekend).toBe("2026-11-28");
    expect(shortcuts.nextWeek).toBe("2026-11-23");
  });

  it("un lundi : semaine prochaine = lundi d'après", () => {
    expect(dateShortcuts("2026-11-23").nextWeek).toBe("2026-11-30");
  });

  it("passe les fins de mois et d'année, et le changement d'heure", () => {
    expect(dateShortcuts("2026-12-31").tomorrow).toBe("2027-01-01");
    expect(dateShortcuts("2028-02-28").tomorrow).toBe("2028-02-29");
    expect(dateShortcuts("2026-10-24").tomorrow).toBe("2026-10-25");
    expect(dateShortcuts("2026-10-25").tomorrow).toBe("2026-10-26");
  });
});

describe("view.ts côté client", () => {
  it("n'importe ni React, ni Next, ni zod, ni de valeur d'un fichier serveur", () => {
    const source = readFileSync(
      join(process.cwd(), "src/modules/tasks/view.ts"),
      "utf8",
    );

    const imports = [
      ...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm),
    ].map((m) => `${m[1] ? "type " : ""}${m[2]}`);

    expect(imports.sort()).toEqual([
      "./sides",
      "type ./queries",
      "type @/modules/core/sides",
    ]);
  });
});
