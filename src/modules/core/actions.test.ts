// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserTx } from "@/db/client";

const listContexts = vi.hoisted(() => vi.fn());
const setMemberLocale = vi.hoisted(() => vi.fn());

vi.mock("./queries", () => ({ listContexts }));
vi.mock("./mutations", () => ({ setMemberLocale }));

import { invokeAction, prepareAction, registry } from "../actions/registry";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const USER = "dc42fa70-09a7-4038-a3bb-f61dda854910";
const OTHER_USER = "7b0d6a1e-2c3f-4e5a-9b8c-1d2e3f4a5b6c";
const tx = {} as UserTx;
const CTX = { workspaceId: WORKSPACE, userId: USER, tx };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("action core.listContexts", () => {
  it("lit les contextes du côté demandé dans le workspace de la session", async () => {
    listContexts.mockResolvedValue([]);

    const prepared = prepareAction(registry, "core.listContexts", {
      side: "pro",
    });
    await invokeAction(prepared, CTX);

    expect(listContexts).toHaveBeenCalledWith(WORKSPACE, { side: "pro" }, tx);
  });

  it("refuse un workspaceId passé en paramètre", () => {
    const attempt = () =>
      prepareAction(registry, "core.listContexts", {
        side: "pro",
        workspaceId: WORKSPACE,
      });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
    expect(listContexts).not.toHaveBeenCalled();
  });
});

describe("action core.setLocale", () => {
  it("enregistre la langue de l'utilisateur de la session, dans son workspace", async () => {
    setMemberLocale.mockResolvedValue("en");

    const prepared = prepareAction(registry, "core.setLocale", {
      locale: "en",
    });
    const saved = await invokeAction(prepared, CTX);

    expect(setMemberLocale).toHaveBeenCalledWith(WORKSPACE, USER, "en", tx);
    expect(saved).toBe("en");
  });

  it("refuse un userId passé en paramètre, sans rien écrire", () => {
    const attempt = () =>
      prepareAction(registry, "core.setLocale", {
        locale: "en",
        userId: OTHER_USER,
      });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
    expect(setMemberLocale).not.toHaveBeenCalled();
  });

  it("refuse une langue inconnue, sans rien écrire", () => {
    const attempt = () =>
      prepareAction(registry, "core.setLocale", { locale: "de" });

    expect(attempt).toThrow(
      expect.objectContaining({ code: "invalid_params" }),
    );
    expect(setMemberLocale).not.toHaveBeenCalled();
  });
});
