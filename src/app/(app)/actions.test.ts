// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());
const calls = vi.hoisted(() => [] as string[]);
// Jeton refusé (expiré entre la garde et withUserDb) : la vraie reconnaissance est testée dans session.test.ts.
const RejectedToken = vi.hoisted(() => class RejectedToken extends Error {});
const redirectIfRejectedToken = vi.hoisted(() =>
  vi.fn(async (error: unknown) => {
    if (error instanceof RejectedToken)
      throw new Error("REDIRECT:/login?next=%2Fdashboard");
  }),
);

vi.mock("@/lib/session", () => ({
  requireSessionWithToken,
  redirectIfRejectedToken,
}));
vi.mock("@/modules/actions/run", () => ({ runActionWithToken }));
vi.mock("@/lib/locale-cookie", () => ({ syncLocaleCookie }));
vi.mock("next/cache", () => ({ refresh }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { ActionError } from "@/modules/actions/errors";

import { TokenVerificationUnavailableError } from "../../../tests/factories/token-errors";

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
  runActionWithToken.mockImplementation(async (_t, _w, _o, name: string) => {
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
  it("lance l'action avec le jeton et le workspace de la session, origine palette, jamais un workspace reçu", async () => {
    const outcome = await runAction("core.listContexts", {
      side: "pro",
      workspaceId: OTHER_WORKSPACE,
    });

    expect(runActionWithToken).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "palette",
      "core.listContexts",
      { side: "pro", workspaceId: OTHER_WORKSPACE },
    );
    expect(outcome).toEqual({ ok: true, result: [] });
  });

  it("l'origine est toujours palette, même si les paramètres en annoncent une autre", async () => {
    await runAction("core.listContexts", { side: "pro", origin: "assistant" });

    expect(runActionWithToken).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "palette",
      "core.listContexts",
      { side: "pro", origin: "assistant" },
    );
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

  it("un jeton expiré entre la garde et la base renvoie vers /login, sans panne ni Sentry", async () => {
    runActionWithToken.mockRejectedValue(new RejectedToken());

    const run = runAction("core.setLocale", { locale: "en" });

    await expect(run).rejects.toThrow("REDIRECT:/login?next=%2Fdashboard");
    expect(captureException).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  // Emplacement de l'appel seulement : redirectIfRejectedToken est simulé ici. La garantie « une panne du
  // JWKS ne renvoie jamais vers /login » est dans src/lib/session.test.ts (vraies erreurs de withUserDb).
  it("une erreur non reconnue comme jeton refusé suit le chemin des pannes (Sentry, échec générique)", async () => {
    runActionWithToken.mockRejectedValue(
      new TokenVerificationUnavailableError("ERR_JWKS_TIMEOUT"),
    );

    const outcome = await runAction("core.setLocale", { locale: "en" });

    expect(outcome).toEqual({ ok: false });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("un refus attendu n'est journalisé que par son code, jamais comme une panne", async () => {
    runActionWithToken.mockRejectedValue(new ActionError("invalid_params"));

    const outcome = await runAction("core.setLocale", { locale: "de" });

    expect(outcome).toEqual({ ok: false });
    expect(console.warn).toHaveBeenCalledWith("[actions] action refusée", {
      code: "invalid_params",
    });
    expect(console.error).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("une vraie panne part à Sentry avec le nom de l'action seul, sans les paramètres du client ni la session", async () => {
    const failure = new Error("Erreur de base de données");
    runActionWithToken.mockRejectedValue(failure);

    const outcome = await runAction("core.setLocale", { locale: "secret-en" });

    expect(outcome).toEqual({ ok: false });
    expect(captureException).toHaveBeenCalledWith(failure, {
      tags: { action: "core.setLocale" },
    });
    const sent = JSON.stringify(captureException.mock.calls);
    for (const leak of [
      "secret-en",
      "eyJ.jwt.signe",
      SESSION.userId,
      SESSION.workspaceId,
    ]) {
      expect(sent).not.toContain(leak);
    }
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("une vraie panne est aussi journalisée côté serveur, avec l'erreur seule (Sentry peut être inactif)", async () => {
    const failure = new Error("Erreur de base de données");
    runActionWithToken.mockRejectedValue(failure);

    await runAction("core.setLocale", { locale: "secret-en" });

    expect(console.error).toHaveBeenCalledWith(
      "[actions] action en échec",
      failure,
    );
    const logged = JSON.stringify(
      vi.mocked(console.error).mock.calls,
      (_key, value: unknown) =>
        value instanceof Error ? { message: value.message } : value,
    );
    for (const leak of [
      "secret-en",
      "eyJ.jwt.signe",
      SESSION.userId,
      SESSION.workspaceId,
    ]) {
      expect(logged).not.toContain(leak);
    }
  });

  it("un nom d'action qui n'a pas la forme du registre ne part pas en tag", async () => {
    runActionWithToken.mockRejectedValue(new Error("panne"));

    await runAction("antoine@example.test", {});

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { action: "invalid" },
    });
  });

  it("si la recopie du cookie échoue après l'écriture en base, annonce le succès, envoie la panne à Sentry et la journalise", async () => {
    const failure = new Error("cookies indisponibles");
    syncLocaleCookie.mockRejectedValue(failure);

    const outcome = await runAction("core.setLocale", { locale: "en" });

    expect(outcome).toEqual({ ok: true, result: "en" });
    expect(captureException).toHaveBeenCalledWith(failure, {
      tags: { action: "core.setLocale" },
    });
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
