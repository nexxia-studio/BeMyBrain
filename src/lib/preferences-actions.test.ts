// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import { setContextSelection, setSide } from "./preferences-actions";

const NEXXIA = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({
    userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
    workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
    workspaceName: "BeMyBrain",
  });
});

describe("bascule Privé / Pro (Server Action)", () => {
  it("enregistre le côté choisi dans bmb_side", async () => {
    await setSide("pro");

    expect(cookieStore.set).toHaveBeenCalledWith(
      "bmb_side",
      "pro",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });

  it("n'écrit rien pour un côté inconnu", async () => {
    await setSide("perso");

    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("refuse sans session, avant toute écriture", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(setSide("pro")).rejects.toThrow("REDIRECT:/login");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});

describe("filtre de contexte (Server Action)", () => {
  it("enregistre les contextes choisis dans bmb_contexts", async () => {
    await setContextSelection([NEXXIA]);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "bmb_contexts",
      NEXXIA,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("efface le filtre quand tous les contextes sont demandés (null)", async () => {
    await setContextSelection(null);

    expect(cookieStore.delete).toHaveBeenCalledWith("bmb_contexts");
  });

  it("n'écrit rien pour une sélection mal formée", async () => {
    await setContextSelection(["pas-un-uuid"]);

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });
});
