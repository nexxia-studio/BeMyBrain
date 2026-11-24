import { afterEach, describe, expect, it, vi } from "vitest";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const requireSession = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/session", () => ({ requireSession, requireSessionWithToken }));

import KanbanDemoLayout from "./layout";

const children = <p>contenu</p>;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("layout de la démo du kanban", () => {
  it("répond 404 en production Vercel, sans lire la session", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");

    expect(() => KanbanDemoLayout({ children })).toThrow("NEXT_NOT_FOUND");

    expect(requireSession).not.toHaveBeenCalled();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("répond 404 sur un build de production hors Vercel, sans lire la session", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", undefined);

    expect(() => KanbanDemoLayout({ children })).toThrow("NEXT_NOT_FOUND");

    expect(requireSession).not.toHaveBeenCalled();
    expect(requireSessionWithToken).not.toHaveBeenCalled();
  });

  it("rend ses enfants sur une preview Vercel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");

    const rendered = KanbanDemoLayout({ children });

    expect(rendered).toBe(children);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("rend ses enfants en développement local", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", undefined);

    const rendered = KanbanDemoLayout({ children });

    expect(rendered).toBe(children);
  });
});
