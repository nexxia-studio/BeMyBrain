import { describe, expect, it } from "vitest";

import { AISLE_KEYS } from "./aisles";
import {
  groupByAisle,
  resolveAisleOrder,
  type ShoppingItem,
} from "./list-view";

const item = (
  id: string,
  aisleKey: ShoppingItem["aisleKey"],
  checkedAt: string | null = null,
): ShoppingItem => ({
  id,
  label: id,
  aisleKey,
  checkedAt: checkedAt ? new Date(checkedAt) : null,
  addedByGuest: false,
});

describe("resolveAisleOrder", () => {
  it("rend l'ordre par défaut sans ordre mémorisé", () => {
    expect(resolveAisleOrder(null)).toEqual([...AISLE_KEYS]);
  });

  it("place l'ordre mémorisé en tête, puis les rayons manquants dans l'ordre par défaut", () => {
    const order = resolveAisleOrder(["frozen", "produce"]);

    expect(order.slice(0, 2)).toEqual(["frozen", "produce"]);
    expect(order).toHaveLength(AISLE_KEYS.length);
    expect(new Set(order)).toEqual(new Set(AISLE_KEYS));
    expect(order.slice(2)).toEqual(
      AISLE_KEYS.filter((k) => k !== "frozen" && k !== "produce"),
    );
  });

  it("ignore une clé inconnue ou répétée", () => {
    const order = resolveAisleOrder(["drinks", "nope", "drinks"]);

    expect(order.filter((k) => k === "drinks")).toHaveLength(1);
    expect(order).not.toContain("nope" as never);
    expect(order).toHaveLength(AISLE_KEYS.length);
  });
});

describe("groupByAisle", () => {
  it("n'affiche que les rayons qui ont des articles, dans l'ordre de l'utilisateur", () => {
    const groups = groupByAisle(
      [item("a", "produce"), item("b", "frozen"), item("c", "produce")],
      resolveAisleOrder(["frozen"]),
    );

    expect(groups.map((g) => g.aisleKey)).toEqual(["frozen", "produce"]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("met les cochés en bas de leur rayon, triés par date de cochage", () => {
    const groups = groupByAisle(
      [
        item("old", "produce", "2026-01-01T10:00:00Z"),
        item("open1", "produce"),
        item("recent", "produce", "2026-01-01T12:00:00Z"),
        item("open2", "produce"),
      ],
      resolveAisleOrder(null),
    );

    expect(groups[0]!.items.map((i) => i.id)).toEqual([
      "open1",
      "open2",
      "old",
      "recent",
    ]);
  });

  it("rend une liste vide sans article", () => {
    expect(groupByAisle([], resolveAisleOrder(null))).toEqual([]);
  });
});
