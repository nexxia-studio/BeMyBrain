import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildTask } from "../../../tests/factories/build-task";

import {
  dateShortcuts,
  dueDateInstant,
  findTagName,
  groupBySection,
  isOverdue,
  matchTagNames,
  sideTileItems,
  subtaskCounter,
  tagChanges,
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

  it("dans une section : échéance, puis heure, puis priorité (aucune en dernier), puis création", () => {
    const lateUrgent = buildTask({ dueDate: "2026-12-10", priority: 1 });
    const earlyNone = buildTask({ dueDate: "2026-11-22", priority: 0 });
    const sameDayNoTime = buildTask({ dueDate: "2026-11-25", priority: 1 });
    const sameDay9h = buildTask({
      dueDate: "2026-11-25",
      dueTime: "09:00",
      priority: 4,
    });
    const sameDay14hLowNew = buildTask({
      dueDate: "2026-11-25",
      dueTime: "14:00",
      priority: 4,
      createdAt: new Date("2026-11-02T08:00:00Z"),
    });
    const sameDay14hLowOld = buildTask({
      dueDate: "2026-11-25",
      dueTime: "14:00",
      priority: 4,
      createdAt: new Date("2026-11-01T08:00:00Z"),
    });
    const sameDay14hHigh = buildTask({
      dueDate: "2026-11-25",
      dueTime: "14:00",
      priority: 2,
    });

    const sections = groupBySection(
      [
        lateUrgent,
        sameDayNoTime,
        sameDay14hLowNew,
        earlyNone,
        sameDay14hHigh,
        sameDay9h,
        sameDay14hLowOld,
      ],
      today,
    );

    expect(sections.map((s) => s.key)).toEqual(["later"]);
    expect(ids(sections[0]?.tasks ?? [])).toEqual([
      earlyNone.id,
      sameDay9h.id,
      sameDay14hHigh.id,
      sameDay14hLowOld.id,
      sameDay14hLowNew.id,
      sameDayNoTime.id,
      lateUrgent.id,
    ]);
  });

  it("en retard : la plus ancienne échéance d'abord", () => {
    const yesterday = buildTask({ dueDate: "2026-11-18", priority: 1 });
    const lastWeek = buildTask({ dueDate: "2026-11-12", priority: 4 });

    const sections = groupBySection([yesterday, lastWeek], today);

    expect(ids(sections[0]?.tasks ?? [])).toEqual([lastWeek.id, yesterday.id]);
  });

  it("sans échéance : priorité (aucune en dernier) puis création", () => {
    const none = buildTask({ priority: 0 });
    const lowNew = buildTask({
      priority: 4,
      createdAt: new Date("2026-11-02T08:00:00Z"),
    });
    const urgent = buildTask({ priority: 1 });
    const lowOld = buildTask({
      priority: 4,
      createdAt: new Date("2026-11-01T08:00:00Z"),
    });

    const sections = groupBySection([none, lowNew, urgent, lowOld], today);

    expect(sections.map((s) => s.key)).toEqual(["none"]);
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

  // Jeudi 2026-11-19 : week-end des 21 et 22 novembre.
  it.each([
    ["lundi", "2026-11-16", "2026-11-21"],
    ["mardi", "2026-11-17", "2026-11-21"],
    ["mercredi", "2026-11-18", "2026-11-21"],
    ["jeudi", "2026-11-19", "2026-11-21"],
    ["vendredi", "2026-11-20", "2026-11-21"],
    ["samedi", "2026-11-21", "2026-11-21"],
    ["dimanche", "2026-11-22", "2026-11-22"],
  ])("ce week-end un %s (%s) = %s", (_day, day, weekend) => {
    expect(dateShortcuts(day).weekend).toBe(weekend);
  });

  it("un dimanche : semaine prochaine = le lendemain", () => {
    expect(dateShortcuts("2026-11-22").nextWeek).toBe("2026-11-23");
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

describe("matchTagNames", () => {
  it("filtre les tags par morceau du nom, sans casse, dans l'ordre reçu", () => {
    const names = ["Client", "maison", "Clinique"];

    const matched = matchTagNames(names, "  CLI ");

    expect(matched).toEqual(["Client", "Clinique"]);
  });

  it("recherche vide : tous les tags", () => {
    const names = ["client", "maison"];

    const matched = matchTagNames(names, "  ");

    expect(matched).toEqual(["client", "maison"]);
  });
});

describe("findTagName", () => {
  it("retrouve un tag existant sans casse ni espaces autour, sous son nom enregistré", () => {
    const names = ["Client", "maison"];

    const found = findTagName(names, " client ");

    expect(found).toBe("Client");
  });

  it("nom inconnu : undefined", () => {
    const names = ["Client"];

    const found = findTagName(names, "clients");

    expect(found).toBeUndefined();
  });
});

describe("dueDateInstant", () => {
  it("donne un instant du même jour local, quel que soit le fuseau d'affichage (de -11 h à +11 h)", () => {
    const instant = dueDateInstant("2026-11-17");

    for (const timeZone of ["Etc/GMT+11", "UTC", "Etc/GMT-11"]) {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone }).format(
        instant,
      );
      expect(day).toBe("2026-11-17");
    }
  });
});

describe("isOverdue", () => {
  it("tâche ouverte due avant aujourd'hui : en retard", () => {
    expect(isOverdue(buildTask({ dueDate: "2026-11-18" }), today)).toBe(true);
  });

  it("due aujourd'hui ou sans échéance : pas en retard", () => {
    expect(isOverdue(buildTask({ dueDate: today }), today)).toBe(false);
    expect(isOverdue(buildTask(), today)).toBe(false);
  });

  it("terminée ou annulée : jamais en retard", () => {
    const due = { dueDate: "2026-11-01" };

    expect(
      isOverdue(buildTask({ ...due, statusCategory: "completed" }), today),
    ).toBe(false);
    expect(
      isOverdue(buildTask({ ...due, statusCategory: "canceled" }), today),
    ).toBe(false);
  });
});

describe("tagChanges", () => {
  it("ajouts et retraits entre les tags enregistrés et les tags choisis", () => {
    expect(tagChanges(["client", "devis"], ["devis", "urgent"])).toEqual({
      addTags: ["urgent"],
      removeTags: ["client"],
    });
  });

  it("même nom dans une autre casse : aucun changement", () => {
    expect(tagChanges(["Client"], ["client"])).toBeNull();
  });

  it("seulement des ajouts : pas de removeTags", () => {
    expect(tagChanges([], ["client"])).toEqual({ addTags: ["client"] });
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
