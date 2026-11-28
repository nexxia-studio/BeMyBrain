import { describe, expect, it } from "vitest";

import { AISLE_KEYS, type AisleKey } from "@/modules/shopping/aisles";

import { mergeAisleOrder } from "./merge-aisle-order";

describe("mergeAisleOrder", () => {
  it("renvoie une permutation des 12 clés quand tous les rayons sont visibles", () => {
    const visible: AisleKey[] = ["frozen", ...AISLE_KEYS.filter((k) => k !== "frozen")];

    expect(mergeAisleOrder(visible)).toEqual(visible);
  });

  it("garde les rayons masqués, chacun après le rayon visible qui le précède par défaut", () => {
    const merged = mergeAisleOrder(["drinks", "produce"]);

    expect([...merged].sort()).toEqual([...AISLE_KEYS].sort());
    expect(merged).toHaveLength(12);
    expect(merged.indexOf("drinks")).toBeLessThan(merged.indexOf("produce"));
    // « bakery » (masqué) suit « produce » ; « hygiene » suit « drinks ».
    expect(merged[merged.indexOf("produce") + 1]).toBe("bakery");
    expect(merged[merged.indexOf("drinks") + 1]).toBe("household");
  });

  it("place en tête un rayon masqué qui n'a aucun visible avant lui par défaut", () => {
    expect(mergeAisleOrder(["frozen"])[0]).toBe("produce");
  });

  it("ne répète aucune clé", () => {
    expect(new Set(mergeAisleOrder(["other", "frozen"])).size).toBe(12);
  });
});
