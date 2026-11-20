import { afterEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn() }));
vi.mock("@/components/shell/PageHeader", () => ({ PageHeader: () => null }));

import GlassDemoPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("page de démo des effets de verre", () => {
  it("répond 404 en production Vercel, sans lire la session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(GlassDemoPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("répond 404 sur un build de production hors Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);

    await expect(GlassDemoPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("lit la session sur une preview Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    requireSessionWithToken.mockRejectedValue(new Error("SESSION_LUE"));

    await expect(GlassDemoPage()).rejects.toThrow("SESSION_LUE");

    expect(notFound).not.toHaveBeenCalled();
  });
});
