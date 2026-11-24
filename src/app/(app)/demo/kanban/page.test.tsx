import { afterEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const getTranslations = vi.hoisted(() => vi.fn(async () => (key: string) => key));
const PageHeader = vi.hoisted(() => vi.fn(() => null));
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("next-intl/server", () => ({ getTranslations }));
vi.mock("@/components/shell/PageHeader", () => ({ PageHeader }));
vi.mock("./KanbanDemo", () => ({ KanbanDemo: () => null }));

import KanbanDemoPage from "./page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("page de démo du kanban", () => {
  it("répond 404 en production Vercel, sans lire la session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(KanbanDemoPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledOnce();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("répond 404 sur un build de production hors Vercel, sans lire la session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);

    await expect(KanbanDemoPage()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("exige la session sur une preview Vercel", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    requireSessionWithToken.mockRejectedValue(new Error("SESSION_LUE"));

    await expect(KanbanDemoPage()).rejects.toThrow("SESSION_LUE");

    expect(notFound).not.toHaveBeenCalled();
  });

  it("n'affiche pas le filtre d'espace, la démo ne lit aucune donnée", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);
    requireSessionWithToken.mockResolvedValue({});

    const tree = await KanbanDemoPage();

    const header = (tree.props.children as React.ReactElement[])[0];
    expect(header.props).toMatchObject({ contextFilter: false });
  });
});
