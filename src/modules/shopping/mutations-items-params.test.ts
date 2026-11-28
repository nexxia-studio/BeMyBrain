import { describe, expect, it } from "vitest";

import type { UserTx } from "@/db/client";

import {
  checkItem,
  clearChecked,
  removeItem,
  renameItem,
  uncheckItem,
} from "./mutations";

// Paramètres refusés avant toute requête : la transaction factice échoue si elle est touchée.
const untouchedTx = new Proxy(
  {},
  {
    get() {
      throw new Error("transaction touchée");
    },
  },
) as unknown as UserTx;

const WORKSPACE = "00000000-0000-4000-8000-000000000001";
const ITEM = "00000000-0000-4000-8000-000000000002";

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e as { code?: string }).code ?? "autre",
  );

describe("écritures sur un article : refus avant toute requête", () => {
  it.each([
    ["checkItem", (ws: string, id: string) => checkItem(ws, id, untouchedTx)],
    [
      "uncheckItem",
      (ws: string, id: string) => uncheckItem(ws, id, untouchedTx),
    ],
    ["removeItem", (ws: string, id: string) => removeItem(ws, id, untouchedTx)],
    [
      "renameItem",
      (ws: string, id: string) => renameItem(ws, id, "pain", untouchedTx),
    ],
  ])(
    "%s refuse un id d'article ou de workspace qui n'est pas un uuid",
    async (_n, run) => {
      expect(await codeOf(run(WORKSPACE, "pas-un-uuid"))).toBe(
        "invalid_params",
      );
      expect(await codeOf(run("pas-un-uuid", ITEM))).toBe("invalid_params");
    },
  );

  it("clearChecked refuse un workspace qui n'est pas un uuid", async () => {
    expect(await codeOf(clearChecked("x", untouchedTx))).toBe("invalid_params");
  });

  it.each([
    ["vide", "   ", "invalid_params"],
    ["caractère de contrôle", "pa\u0000in", "invalid_params"],
    ["trop long", "a".repeat(81), "label_too_long"],
  ])("renameItem refuse un libellé %s", async (_n, label, code) => {
    expect(await codeOf(renameItem(WORKSPACE, ITEM, label, untouchedTx))).toBe(
      code,
    );
  });
});
