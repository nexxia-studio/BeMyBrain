import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const renderDashboard = vi.hoisted(() => vi.fn(async () => "tableau-de-bord"));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
// Vrai tableau de bord : testé à part (dashboard/page.test.tsx), remplacé ici par un témoin.
vi.mock("@/app/(app)/dashboard/render-dashboard", () => ({
  renderDashboard,
}));

import { SLOW_LOAD_MS } from "../slow-load";
import SlowDashboardPage from "./page";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("tableau de bord au chargement ralenti (démo)", () => {
  it("répond 404 en production Vercel, sans lire la session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(SlowDashboardPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireSessionWithToken).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("répond 404 sur un build de production hors Vercel, sans lire la session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);

    await expect(SlowDashboardPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("sur preview, lit la session avant le délai", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    requireSessionWithToken.mockRejectedValue(new Error("SESSION_REFUSEE"));

    await expect(SlowDashboardPage()).rejects.toThrow("SESSION_REFUSEE");

    expect(notFound).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rend le vrai tableau de bord après le délai, cookie des hauteurs au chemin de la route lente", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    requireSessionWithToken.mockResolvedValue({});
    let rendered: unknown = undefined;

    const page = SlowDashboardPage().then((result) => {
      rendered = result;
    });
    await vi.advanceTimersByTimeAsync(SLOW_LOAD_MS - 1);
    const beforeDelay = rendered;
    await vi.advanceTimersByTimeAsync(1);
    await page;

    expect(requireSessionWithToken).toHaveBeenCalledOnce();
    expect(beforeDelay).toBeUndefined();
    expect(rendered).toBe("tableau-de-bord");
    expect(renderDashboard).toHaveBeenCalledWith({
      tileHeightsPath: "/demo/effets-de-verre/lent/tableau-de-bord",
    });
  });
});
