import { isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const DashboardPage = vi.hoisted(() => vi.fn(() => null));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
// Vraie page du tableau de bord : testée à part, remplacée ici par un témoin.
vi.mock("@/app/(app)/dashboard/page", () => ({ default: DashboardPage }));

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

  it("rend la vraie page après le délai", async () => {
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
    expect(isValidElement(rendered) && rendered.type).toBe(DashboardPage);
  });
});
