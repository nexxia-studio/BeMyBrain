// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const requireSessionToken = vi.hoisted(() => vi.fn());
const saveMemberLocale = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/session", () => ({ requireSession, requireSessionToken }));
vi.mock("@/modules/core/locale", () => ({ saveMemberLocale }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie }));
vi.mock("next/cache", () => ({ refresh }));

import { setLocale } from "./actions";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "BeMyBrain",
};

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  requireSession.mockImplementation(async () => {
    calls.push("requireSession");
    return SESSION;
  });
  requireSessionToken.mockResolvedValue("eyJ.jwt.signe");
  saveMemberLocale.mockImplementation(async (_t, _w, locale: string) => {
    calls.push("saveMemberLocale");
    return locale;
  });
  syncLocaleCookie.mockImplementation(async () => {
    calls.push("syncLocaleCookie");
  });
  refresh.mockImplementation(() => {
    calls.push("refresh");
  });
});

describe("changer de langue (Server Action)", () => {
  it("enregistre la langue dans le workspace de la session, la recopie dans NEXT_LOCALE puis rafraîchit", async () => {
    await setLocale("en");

    expect(saveMemberLocale).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "en",
    );
    expect(syncLocaleCookie).toHaveBeenCalledWith("en");
    expect(calls).toEqual([
      "requireSession",
      "saveMemberLocale",
      "syncLocaleCookie",
      "refresh",
    ]);
  });

  it("n'enregistre rien pour une langue inconnue", async () => {
    await setLocale("de");

    expect(saveMemberLocale).not.toHaveBeenCalled();
    expect(syncLocaleCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ne recopie pas le cookie si l'enregistrement échoue, et l'erreur remonte", async () => {
    saveMemberLocale.mockRejectedValue(new Error("member_not_found"));

    await expect(setLocale("en")).rejects.toThrow("member_not_found");
    expect(syncLocaleCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refuse sans session, avant toute écriture", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(setLocale("en")).rejects.toThrow("REDIRECT:/login");
    expect(saveMemberLocale).not.toHaveBeenCalled();
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });
});
