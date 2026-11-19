import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
const redirectIfRejectedToken = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/lib/session", () => ({ redirectIfRejectedToken }));

import { settleTile } from "./settle-tile";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("lecture d'une tuile du tableau de bord", () => {
  it("renvoie la valeur lue", async () => {
    const value = await settleTile("today", async () => [1, 2]);

    expect(value).toEqual([1, 2]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("panne : null, journalisée et envoyée à Sentry avec le nom de la tuile seul", async () => {
    const error = new Error("panne");

    const value = await settleTile("sideTodo", async () => {
      throw error;
    });

    expect(value).toBeNull();
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { tile: "sideTodo" },
    });
  });

  it("jeton refusé : renvoi vers /login, pas une panne", async () => {
    redirectIfRejectedToken.mockRejectedValue(new Error("REDIRECT:/login"));

    const run = settleTile("today", async () => {
      throw new Error("jeton refusé");
    });

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(captureException).not.toHaveBeenCalled();
  });

  it("erreur de contrôle de Next (redirect) : relancée telle quelle", async () => {
    const control = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });

    const run = settleTile("today", async () => {
      throw control;
    });

    await expect(run).rejects.toBe(control);
    expect(captureException).not.toHaveBeenCalled();
  });
});
