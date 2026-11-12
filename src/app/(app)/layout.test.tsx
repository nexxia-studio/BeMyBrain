// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

import AppLayout from "./layout";

beforeEach(() => {
  requireSession.mockReset();
});

describe("layout de l'app (second verrou)", () => {
  it("ne rend rien quand requireSession redirige (pas de session)", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    const render = AppLayout({ children: null });

    await expect(render).rejects.toThrow("REDIRECT:/login");
  });

  it("rend la page quand la session est résolue", async () => {
    requireSession.mockResolvedValue({
      userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
      workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
      workspaceName: "BeMyBrain",
    });

    const element = await AppLayout({ children: null });

    expect(element).not.toBeNull();
    expect(requireSession).toHaveBeenCalledTimes(1);
  });
});
