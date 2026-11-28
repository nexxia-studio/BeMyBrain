import { describe, expect, it } from "vitest";

import { AISLE_KEYS } from "./aisles";
import { applyVisibleOrder } from "./visible-order";

describe("applyVisibleOrder", () => {
  it("remplace seulement les rayons visibles, les masqués gardent leur place", () => {
    const full = [...AISLE_KEYS];
    const [a, b, c, d] = full;

    const result = applyVisibleOrder(full, [d, b]);

    expect(result[0]).toBe(a);
    expect(result[1]).toBe(d);
    expect(result[2]).toBe(c);
    expect(result[3]).toBe(b);
    expect(result.slice(4)).toEqual(full.slice(4));
  });

  it("garde les 12 clés, sans doublon", () => {
    const full = [...AISLE_KEYS].reverse();

    const result = applyVisibleOrder(full, [full[5], full[2], full[9]]);

    expect([...result].sort()).toEqual([...AISLE_KEYS].sort());
  });
});
