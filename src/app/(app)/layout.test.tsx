// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSession }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import AppLayout from "./layout";

beforeEach(() => {
  getSession.mockReset();
});

describe("layout de l'app (second verrou)", () => {
  it("redirige vers /login quand la session serveur est absente", async () => {
    getSession.mockResolvedValue(null);

    const render = AppLayout({ children: null });

    await expect(render).rejects.toThrow("REDIRECT:/login");
  });

  it("rend la page quand la session serveur existe", async () => {
    getSession.mockResolvedValue({
      user: { id: "dc42fa70-09a7-4038-a3bb-f61dda854910" },
    });

    const element = await AppLayout({ children: null });

    expect(element).not.toBeNull();
  });
});
