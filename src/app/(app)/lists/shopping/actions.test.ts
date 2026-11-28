// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());

const redirectIfRejectedToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({
  requireSessionWithToken,
  redirectIfRejectedToken,
}));
vi.mock("@/modules/actions/run", () => ({ runActionWithToken }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie: vi.fn() }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { ActionError } from "@/modules/actions/errors";
import { AISLE_KEYS } from "@/modules/shopping/aisles";
import { ShoppingError } from "@/modules/shopping/errors";

import * as actions from "./actions";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "BeMyBrain",
};
const ITEM = "3c6d1f0e-8a2b-4c5d-9e7f-0a1b2c3d4e5f";

beforeEach(() => {
  vi.clearAllMocks();
  redirectIfRejectedToken.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireSessionWithToken.mockResolvedValue({
    session: SESSION,
    token: "eyJ.jwt.signe",
  });
  runActionWithToken.mockImplementation(async (_t, _w, _o, name: string) => ({
    name,
    access: "write",
    result: { ok: true },
  }));
});

describe("Server Actions des Courses", () => {
  it("une action par écriture d'écran, chacune vers son action du registre, origine app", async () => {
    const calls: [Promise<unknown>, string, unknown][] = [
      [actions.addShoppingItem("lait"), "shopping.addItem", { label: "lait" }],
      [actions.checkShoppingItem(ITEM), "shopping.checkItem", { itemId: ITEM }],
      [
        actions.uncheckShoppingItem(ITEM),
        "shopping.uncheckItem",
        { itemId: ITEM },
      ],
      [
        actions.renameShoppingItem(ITEM, "pain"),
        "shopping.renameItem",
        { itemId: ITEM, label: "pain" },
      ],
      [
        actions.removeShoppingItem(ITEM),
        "shopping.removeItem",
        { itemId: ITEM },
      ],
      [actions.clearCheckedShoppingItems(), "shopping.clearChecked", {}],
      [
        actions.moveShoppingItemToAisle(ITEM, "bakery"),
        "shopping.moveItemToAisle",
        { itemId: ITEM, aisleKey: "bakery" },
      ],
      [
        actions.setShoppingAisleOrder([...AISLE_KEYS]),
        "shopping.setAisleOrder",
        { order: [...AISLE_KEYS] },
      ],
    ];
    for (const [call, name, params] of calls) {
      await call;
      expect(runActionWithToken).toHaveBeenCalledWith(
        "eyJ.jwt.signe",
        SESSION.workspaceId,
        "app",
        name,
        params,
      );
    }
    expect(runActionWithToken).toHaveBeenCalledTimes(calls.length);
    expect(refresh).toHaveBeenCalledTimes(calls.length);
  });

  it("le workspaceId vient de la session, jamais des arguments", async () => {
    await actions.addShoppingItem("lait");
    expect(runActionWithToken.mock.calls[0]?.[1]).toBe(SESSION.workspaceId);
    expect(JSON.stringify(runActionWithToken.mock.calls[0]?.[4])).not.toContain(
      SESSION.workspaceId,
    );
  });

  it("refuse sans session, avant toute action", async () => {
    requireSessionWithToken.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(actions.addShoppingItem("lait")).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(runActionWithToken).not.toHaveBeenCalled();
  });

  it("renvoie vers /login quand le jeton est refusé entre la garde et la base", async () => {
    const tokenRefusal = new Error("jeton refusé");
    runActionWithToken.mockRejectedValue(tokenRefusal);
    redirectIfRejectedToken.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(actions.addShoppingItem("lait")).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(redirectIfRejectedToken).toHaveBeenCalledWith(tokenRefusal);
  });

  it("une erreur de validation renvoie un code, pas une exception", async () => {
    runActionWithToken.mockRejectedValue(new ActionError("invalid_params"));
    await expect(actions.addShoppingItem("")).resolves.toEqual({
      ok: false,
      code: "invalid_params",
    });
  });

  it("un refus métier de la liste renvoie son code", async () => {
    runActionWithToken.mockRejectedValue(new ShoppingError("list_full"));
    await expect(actions.addShoppingItem("lait")).resolves.toEqual({
      ok: false,
      code: "list_full",
    });
  });

  it("un refus d'un autre module ou une panne renvoie un échec sans code", async () => {
    runActionWithToken.mockRejectedValueOnce(new ActionError("unknown_action"));
    await expect(actions.addShoppingItem("x")).resolves.toEqual({ ok: false });
    runActionWithToken.mockRejectedValueOnce(new Error("boom"));
    await expect(actions.addShoppingItem("x")).resolves.toEqual({ ok: false });
  });
});
