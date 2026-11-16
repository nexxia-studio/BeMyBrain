// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/modules/actions/run", () => ({ runActionWithToken }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie }));
vi.mock("next/cache", () => ({ refresh }));

import { ActionError } from "@/modules/actions/errors";

import { runAction } from "./actions";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "BeMyBrain",
};
const OTHER_WORKSPACE = "7b0d6a1e-2c3f-4e5a-9b8c-1d2e3f4a5b6c";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireSessionWithToken.mockImplementation(async () => {
    calls.push("requireSessionWithToken");
    return { session: SESSION, token: "eyJ.jwt.signe" };
  });
  runActionWithToken.mockImplementation(async (_t, _w, name: string) => {
    calls.push("runActionWithToken");
    return { name, result: name === "core.setLocale" ? "en" : [] };
  });
  syncLocaleCookie.mockImplementation(async () => {
    calls.push("syncLocaleCookie");
  });
  refresh.mockImplementation(() => {
    calls.push("refresh");
  });
});

describe("runAction (Server Action unique de la palette)", () => {
  it("lance l'action avec le jeton et le workspace de la session, jamais un workspace reçu", async () => {
    const outcome = await runAction("core.listContexts", {
      side: "pro",
      workspaceId: OTHER_WORKSPACE,
    });

    expect(runActionWithToken).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "core.listContexts",
      { side: "pro", workspaceId: OTHER_WORKSPACE },
    );
    expect(outcome).toEqual({ ok: true, result: [] });
  });

  it("après core.setLocale, recopie la langue enregistrée dans NEXT_LOCALE puis rafraîchit", async () => {
    const outcome = await runAction("core.setLocale", { locale: "en" });

    expect(outcome).toEqual({ ok: true, result: "en" });
    expect(syncLocaleCookie).toHaveBeenCalledWith("en");
    expect(calls).toEqual([
      "requireSessionWithToken",
      "runActionWithToken",
      "syncLocaleCookie",
      "refresh",
    ]);
  });

  it("une action de lecture ne touche ni au cookie ni au rendu", async () => {
    await runAction("core.listContexts", { side: "pro" });

    expect(syncLocaleCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un nom inconnu ou des paramètres invalides renvoient une erreur générique", async () => {
    runActionWithToken
      .mockRejectedValueOnce(new ActionError("unknown_action"))
      .mockRejectedValueOnce(new ActionError("invalid_params"));

    const unknown = await runAction("core.drop", {});
    const invalid = await runAction("core.setLocale", { locale: "de" });

    expect(unknown).toEqual({ ok: false });
    expect(invalid).toEqual({ ok: false });
    expect(syncLocaleCookie).not.toHaveBeenCalled();
  });

  it("un échec en base renvoie la même erreur générique, sans détail ni cookie", async () => {
    runActionWithToken.mockRejectedValue(
      new Error("Erreur de base de données"),
    );

    const outcome = await runAction("core.setLocale", { locale: "en" });

    expect(outcome).toEqual({ ok: false });
    expect(syncLocaleCookie).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un refus attendu n'est journalisé que par son code, jamais comme une panne", async () => {
    runActionWithToken.mockRejectedValue(new ActionError("invalid_params"));

    const outcome = await runAction("core.setLocale", { locale: "de" });

    expect(outcome).toEqual({ ok: false });
    expect(console.warn).toHaveBeenCalledWith("[actions] action refusée", {
      code: "invalid_params",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("une vraie panne est journalisée en erreur côté serveur, sans les paramètres du client", async () => {
    const failure = new Error("Erreur de base de données");
    runActionWithToken.mockRejectedValue(failure);

    const outcome = await runAction("core.setLocale", { locale: "secret-en" });

    expect(outcome).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith(
      "[actions] action en échec",
      failure,
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "secret-en",
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("si la recopie du cookie échoue après l'écriture en base, annonce le succès et journalise la panne", async () => {
    const failure = new Error("cookies indisponibles");
    syncLocaleCookie.mockRejectedValue(failure);

    const outcome = await runAction("core.setLocale", { locale: "en" });

    expect(outcome).toEqual({ ok: true, result: "en" });
    expect(console.error).toHaveBeenCalledWith(
      "[actions] effets web en échec après l'action",
      failure,
    );
  });

  it("refuse sans session, avant toute résolution d'action", async () => {
    requireSessionWithToken.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(runAction("core.setLocale", { locale: "en" })).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(runActionWithToken).not.toHaveBeenCalled();
  });
});
