// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({}));
const JWT_USER = vi.hoisted(() => "dc42fa70-09a7-4038-a3bb-f61dda854910");
const withUserDb = vi.hoisted(() =>
  vi.fn(
    async (
      _token: string,
      fn: (t: unknown, identity: { userId: string }) => unknown,
    ) => fn(tx, { userId: JWT_USER }),
  ),
);
const setMemberLocale = vi.hoisted(() => vi.fn());

vi.mock("@/db/client", () => ({ withUserDb }));
const assistantOnlyRun = vi.hoisted(() => vi.fn());
const echoOriginRun = vi.hoisted(() =>
  vi.fn(async (ctx: { origin: string }) => ctx.origin),
);

vi.mock("@/modules/core/mutations", () => ({ setMemberLocale }));
// Le registre réel, plus une action réservée à l'assistant (runActionWithToken passe le canal "web") et une
// action web qui renvoie l'origine reçue dans son contexte.
vi.mock("@/modules/core/actions", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/modules/core/actions")>();
  const { defineAction } = await import("@/modules/actions/define");
  const { z } = await import("zod");
  const assistantOnly = defineAction({
    name: "core.assistantOnly",
    description: "actions.core.assistantOnly",
    params: z.strictObject({}),
    access: "write",
    channels: ["assistant"],
    run: assistantOnlyRun,
  });
  const echoOrigin = defineAction({
    name: "core.echoOrigin",
    description: "actions.core.echoOrigin",
    params: z.strictObject({}),
    access: "read",
    channels: ["web"],
    run: echoOriginRun,
  });
  return {
    ...original,
    coreActions: [...original.coreActions, assistantOnly, echoOrigin],
  };
});

import { runActionWithToken } from "./run";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exécution d'une action pour la session", () => {
  it("exécute l'action dans une transaction ouverte avec le jeton, pour l'utilisateur du jeton", async () => {
    setMemberLocale.mockResolvedValue("en");

    const outcome = await runActionWithToken(
      "eyJ.jwt.signe",
      WORKSPACE,
      "palette",
      "core.setLocale",
      { locale: "en" },
    );

    expect(withUserDb).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      expect.any(Function),
    );
    expect(setMemberLocale).toHaveBeenCalledWith(WORKSPACE, JWT_USER, "en", tx);
    expect(outcome).toEqual({
      name: "core.setLocale",
      access: "write",
      result: "en",
    });
  });

  it("un nom inconnu n'ouvre aucune transaction", async () => {
    const run = runActionWithToken(
      "eyJ.jwt.signe",
      WORKSPACE,
      "palette",
      "core.drop",
      {},
    );

    await expect(run).rejects.toMatchObject({ code: "unknown_action" });
    expect(withUserDb).not.toHaveBeenCalled();
  });

  it("une action qui ne déclare pas le canal web est refusée, sans transaction ni exécution", async () => {
    const run = runActionWithToken(
      "eyJ.jwt.signe",
      WORKSPACE,
      "palette",
      "core.assistantOnly",
      {},
    );

    await expect(run).rejects.toMatchObject({ code: "unknown_action" });
    expect(withUserDb).not.toHaveBeenCalled();
    expect(assistantOnlyRun).not.toHaveBeenCalled();
  });

  it("des paramètres invalides n'ouvrent aucune transaction", async () => {
    const run = runActionWithToken(
      "eyJ.jwt.signe",
      WORKSPACE,
      "palette",
      "core.setLocale",
      { locale: "de" },
    );

    await expect(run).rejects.toMatchObject({ code: "invalid_params" });
    expect(withUserDb).not.toHaveBeenCalled();
    expect(setMemberLocale).not.toHaveBeenCalled();
  });

  it("l'origine du contexte est celle passée par l'appelant serveur", async () => {
    for (const origin of ["palette", "app"] as const) {
      const outcome = await runActionWithToken(
        "eyJ.jwt.signe",
        WORKSPACE,
        origin,
        "core.echoOrigin",
        {},
      );

      expect(outcome).toEqual({
        name: "core.echoOrigin",
        access: "read",
        result: origin,
      });
      expect(echoOriginRun).toHaveBeenLastCalledWith(
        { workspaceId: WORKSPACE, userId: JWT_USER, origin, tx },
        {},
      );
    }
  });

  it("l'origine ne vient jamais des paramètres : une clé origin reçue est refusée, sans transaction", async () => {
    for (const params of [
      { origin: "assistant" },
      { origin: "app" },
      { locale: "en", origin: "assistant" },
    ]) {
      for (const name of ["core.echoOrigin", "core.setLocale"]) {
        const run = runActionWithToken(
          "eyJ.jwt.signe",
          WORKSPACE,
          "palette",
          name,
          params,
        );

        await expect(run).rejects.toMatchObject({ code: "invalid_params" });
      }
    }
    expect(withUserDb).not.toHaveBeenCalled();
    expect(echoOriginRun).not.toHaveBeenCalled();
    expect(setMemberLocale).not.toHaveBeenCalled();
  });
});
