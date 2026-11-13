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

describe("filtre d'espace (Server Action)", () => {
  it("enregistre l'espace choisi côté Pro dans bmb_contexts_pro", async () => {
    await setContextSelection("pro", [NEXXIA]);

    expect(cookieStore.set).toHaveBeenCalledWith(
      "bmb_contexts_pro",
      NEXXIA,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("enregistre l'espace choisi côté Privé sans toucher au cookie Pro", async () => {
    await setContextSelection("private", [NEXXIA]);

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "bmb_contexts_private",
      NEXXIA,
      expect.anything(),
    );
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("efface le filtre du seul côté demandé quand tous les espaces sont choisis (null)", async () => {
    await setContextSelection("pro", null);

    expect(cookieStore.delete).toHaveBeenCalledTimes(1);
    expect(cookieStore.delete).toHaveBeenCalledWith("bmb_contexts_pro");
  });

  it("n'écrit rien pour une sélection mal formée", async () => {
    await setContextSelection("pro", ["pas-un-uuid"]);

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("n'écrit ni n'efface rien pour un côté inconnu", async () => {
    await setContextSelection("perso", null);
    await setContextSelection("perso", [NEXXIA]);

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it("refuse sans session, avant toute écriture", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(setContextSelection("pro", null)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });
});
