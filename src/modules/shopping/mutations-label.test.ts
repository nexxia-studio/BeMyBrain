import { describe, expect, it } from "vitest";

import type { UserTx } from "@/db/client";

import { addItem } from "./mutations";

// Refus du libellé avant toute requête : la transaction factice échoue si elle est touchée.
const untouchedTx = new Proxy(
  {},
  {
    get() {
      throw new Error("transaction touchée");
    },
  },
) as unknown as UserTx;

const WORKSPACE = "00000000-0000-4000-8000-000000000001";

describe("addItem : caractères de contrôle du libellé", () => {
  it.each([
    ["NUL", "pa\u0000in"],
    ["cloche", "pa\u0007in"],
    ["DEL", "pa\u007fin"],
    ["NUL seul", "\u0000"],
  ])("refuse un libellé avec %s en invalid_params", async (_name, label) => {
    const error = await addItem(WORKSPACE, label, untouchedTx).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ code: "invalid_params" });
  });
});
