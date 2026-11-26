import { describe, expect, it } from "vitest";

import { listQuery, listQueryWith } from "./list-query";

describe("listQuery", () => {
  it("terminées affichées : ?completed=1 gardé", () => {
    expect(listQuery({ completed: "1" })).toBe("?completed=1");
  });

  it("sans interrupteur ou valeur inattendue : rien", () => {
    expect(listQuery({})).toBe("");
    expect(listQuery({ completed: ["1", "1"] })).toBe("");
    expect(listQuery({ completed: "0", autre: "x" })).toBe("");
  });

  it("« Tout voir » du tableau : ?done=all et ?canceled=all gardés, dans un ordre fixe", () => {
    expect(listQuery({ done: "all" })).toBe("?done=all");
    expect(listQuery({ canceled: "all", done: "all", completed: "1" })).toBe(
      "?completed=1&done=all&canceled=all",
    );
  });

  it("« Tout voir » : toute autre valeur est ignorée", () => {
    expect(listQuery({ done: "1", canceled: ["all", "all"] })).toBe("");
  });
});

describe("listQueryWith", () => {
  it("pose un paramètre en gardant les autres", () => {
    expect(listQueryWith({ done: "all" }, "canceled", "all")).toBe(
      "?done=all&canceled=all",
    );
  });

  it("retire un paramètre en gardant les autres ; plus rien : chaîne vide", () => {
    expect(
      listQueryWith({ done: "all", canceled: "all" }, "done", null),
    ).toBe("?canceled=all");
    expect(listQueryWith({ done: "all" }, "done", null)).toBe("");
  });
});
