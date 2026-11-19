import { describe, expect, it } from "vitest";

import { listQuery } from "./list-query";

describe("listQuery", () => {
  it("terminées affichées : ?completed=1 gardé", () => {
    expect(listQuery({ completed: "1" })).toBe("?completed=1");
  });

  it("sans interrupteur ou valeur inattendue : rien", () => {
    expect(listQuery({})).toBe("");
    expect(listQuery({ completed: ["1", "1"] })).toBe("");
    expect(listQuery({ completed: "0", autre: "x" })).toBe("");
  });
});
