import { describe, expect, it } from "vitest";

import { getUserTimeZone } from "@/modules/core/time-zone";

import { sortTrash, type TrashItem, trashDateFormat } from "./trash-item";

function item(key: string, iso: string): TrashItem {
  return {
    key,
    deletedAt: new Date(iso),
    restore: { action: "x.restore", params: { id: key } },
    row: null,
  };
}

describe("sortTrash", () => {
  it("mêle les types par date de mise à la corbeille, la plus récente d'abord", () => {
    const items = [
      item("a:1", "2026-11-19T10:00:00Z"),
      item("a:2", "2026-11-17T10:00:00Z"),
      item("b:1", "2026-11-18T10:00:00Z"),
    ];

    expect(sortTrash(items).map((i) => i.key)).toEqual(["a:1", "b:1", "a:2"]);
  });

  it("à date égale, garde l'ordre reçu", () => {
    const items = [
      item("a:1", "2026-11-19T10:00:00Z"),
      item("b:1", "2026-11-19T10:00:00Z"),
    ];

    expect(sortTrash(items).map((i) => i.key)).toEqual(["a:1", "b:1"]);
  });
});

describe("trashDateFormat", () => {
  const now = new Date("2026-11-19T10:00:00Z");

  it("année en cours : jour et mois seulement", () => {
    expect(
      trashDateFormat(new Date("2026-03-02T10:00:00Z"), now, getUserTimeZone()),
    ).toEqual({ day: "numeric", month: "short" });
  });

  it("autre année : jour, mois et année", () => {
    expect(
      trashDateFormat(new Date("2025-12-30T10:00:00Z"), now, getUserTimeZone()),
    ).toEqual({ day: "numeric", month: "short", year: "numeric" });
  });

  it("année lue dans le fuseau de l'utilisateur, pas en UTC", () => {
    const newYearLocal = new Date("2026-12-31T23:30:00Z");
    const now2027 = new Date("2027-01-05T10:00:00Z");

    expect(trashDateFormat(newYearLocal, now2027, getUserTimeZone())).toEqual({
      day: "numeric",
      month: "short",
    });
  });
});
