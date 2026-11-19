// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const runActionWithToken = vi.hoisted(() => vi.fn());
const syncLocaleCookie = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const captureException = vi.hoisted(() => vi.fn());
// Jeton refusé (expiré entre la garde et withUserDb) : la vraie reconnaissance est testée dans session.test.ts.
const RejectedToken = vi.hoisted(() => class RejectedToken extends Error {});
const redirectIfRejectedToken = vi.hoisted(() =>
  vi.fn(async (error: unknown) => {
    if (error instanceof RejectedToken)
      throw new Error("REDIRECT:/login?next=%2Ftasks");
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
import { TaskError } from "@/modules/tasks/errors";

import { runTaskAction } from "./actions";

const SESSION = {
  userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
  workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
  workspaceName: "BeMyBrain",
};
const OTHER_WORKSPACE = "7b0d6a1e-2c3f-4e5a-9b8c-1d2e3f4a5b6c";
const TASK_ID = "3c6d1f0e-8a2b-4c5d-9e7f-0a1b2c3d4e5f";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireSessionWithToken.mockResolvedValue({
    session: SESSION,
    token: "eyJ.jwt.signe",
  });
  runActionWithToken.mockImplementation(async (_t, _w, _o, name: string) => ({
    name,
    access: name === "tasks.list" ? "read" : "write",
    result: { id: TASK_ID },
  }));
});

describe("runTaskAction (Server Action de l'écran tâches)", () => {
  it("lance l'action avec le jeton et le workspace de la session, origine app", async () => {
    const outcome = await runTaskAction("tasks.create", {
      title: "Payer la crèche",
      side: "private",
    });

    expect(runActionWithToken).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "app",
      "tasks.create",
      { title: "Payer la crèche", side: "private" },
    );
    expect(outcome).toEqual({ ok: true, result: { id: TASK_ID } });
  });

  it("l'origine est toujours app, même si les paramètres annoncent une autre origine ou un autre workspace", async () => {
    await runTaskAction("tasks.create", {
      title: "x",
      origin: "assistant",
      workspaceId: OTHER_WORKSPACE,
    });

    expect(runActionWithToken).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      SESSION.workspaceId,
      "app",
      "tasks.create",
      { title: "x", origin: "assistant", workspaceId: OTHER_WORKSPACE },
    );
  });

  it("une écriture réussie rafraîchit la route (liste et tuiles à jour)", async () => {
    await runTaskAction("tasks.complete", { id: TASK_ID });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("une lecture ne rafraîchit pas la route", async () => {
    await runTaskAction("tasks.list", {});

    expect(refresh).not.toHaveBeenCalled();
  });

  it("un refus métier renvoie son code, seul, pour que l'écran le traduise", async () => {
    runActionWithToken.mockRejectedValue(new TaskError("parent_in_trash"));

    const outcome = await runTaskAction("tasks.restore", { id: TASK_ID });

    expect(outcome).toEqual({ ok: false, code: "parent_in_trash" });
    expect(console.warn).toHaveBeenCalledWith("[actions] action refusée", {
      code: "parent_in_trash",
    });
    expect(captureException).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("un refus du registre renvoie aussi son code", async () => {
    runActionWithToken.mockRejectedValue(new ActionError("invalid_params"));

    const outcome = await runTaskAction("tasks.create", { title: "" });

    expect(outcome).toEqual({ ok: false, code: "invalid_params" });
  });

  it("une panne renvoie un échec sans code ni texte de la base, et part à Sentry avec le nom de l'action seul", async () => {
    const failure = new Error('duplicate key value violates "tasks_pkey"');
    runActionWithToken.mockRejectedValue(failure);

    const outcome = await runTaskAction("tasks.create", { title: "secret" });

    expect(outcome).toEqual({ ok: false });
    expect(captureException).toHaveBeenCalledWith(failure, {
      tags: { action: "tasks.create" },
    });
    expect(JSON.stringify(captureException.mock.calls)).not.toContain("secret");
  });

  it("un jeton expiré entre la garde et la base renvoie vers /login, sans panne", async () => {
    runActionWithToken.mockRejectedValue(new RejectedToken());

    const run = runTaskAction("tasks.complete", { id: TASK_ID });

    await expect(run).rejects.toThrow("REDIRECT:/login?next=%2Ftasks");
    expect(captureException).not.toHaveBeenCalled();
  });

  it("refuse sans session, avant toute résolution d'action", async () => {
    requireSessionWithToken.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(
      runTaskAction("tasks.complete", { id: TASK_ID }),
    ).rejects.toThrow("REDIRECT:/login");
    expect(runActionWithToken).not.toHaveBeenCalled();
  });
});
