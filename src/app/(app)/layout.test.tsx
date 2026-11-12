// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const requireSessionToken = vi.hoisted(() => vi.fn());
const readSide = vi.hoisted(() => vi.fn());
const readContextSelection = vi.hoisted(() => vi.fn());
const loadContexts = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSession, requireSessionToken }));
vi.mock("@/lib/preferences", () => ({ readSide, readContextSelection }));
vi.mock("@/modules/core/contexts", () => ({ loadContexts }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

import { ContextFilter } from "@/components/shell/ContextFilter";

import AppLayout from "./layout";

const WORKSPACE = "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b";
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  side: "pro",
  position: 1,
};
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  side: "pro",
  position: 2,
};

type Element = { type: unknown; props: Record<string, unknown> };

// Parcourt l'arbre rendu (sans l'exécuter) à la recherche d'un élément d'un type donné.
function findElement(node: unknown, type: unknown): Element | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return undefined;
  }
  const element = node as Element;
  if (element.type === type) return element;
  return findElement(element.props?.children, type);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({
    userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
    workspaceId: WORKSPACE,
    workspaceName: "BeMyBrain",
  });
  requireSessionToken.mockResolvedValue("eyJ.jwt.signe");
  readSide.mockResolvedValue("private");
  readContextSelection.mockImplementation(async (ids: string[]) => ids);
  loadContexts.mockResolvedValue([TRUSTUP, NEXXIA]);
});

describe("layout de l'app (second verrou)", () => {
  it("ne rend rien quand requireSession redirige (pas de session)", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    const render = AppLayout({ children: null });

    await expect(render).rejects.toThrow("REDIRECT:/login");
  });

  it("rend la page quand la session est résolue", async () => {
    const element = await AppLayout({ children: null });

    expect(element).not.toBeNull();
    expect(requireSession).toHaveBeenCalledTimes(1);
  });
});

describe("coque : côté et filtre de contexte", () => {
  it("côté Privé, ne lit aucun contexte et n'affiche pas de filtre", async () => {
    const element = await AppLayout({ children: null });

    expect(loadContexts).not.toHaveBeenCalled();
    expect(findElement(element, ContextFilter)).toBeUndefined();
  });

  it("côté Pro, filtre sur les contextes Pro du workspace de la session", async () => {
    readSide.mockResolvedValue("pro");
    readContextSelection.mockResolvedValue([NEXXIA.id]);

    const element = await AppLayout({ children: null });

    expect(loadContexts).toHaveBeenCalledWith(
      "eyJ.jwt.signe",
      WORKSPACE,
      "pro",
    );
    expect(findElement(element, ContextFilter)?.props).toEqual({
      contexts: [
        { id: TRUSTUP.id, name: TRUSTUP.name },
        { id: NEXXIA.id, name: NEXXIA.name },
      ],
      selected: [NEXXIA.id],
    });
  });

  it("côté Pro avec un seul contexte, n'affiche pas de filtre", async () => {
    readSide.mockResolvedValue("pro");
    loadContexts.mockResolvedValue([NEXXIA]);

    const element = await AppLayout({ children: null });

    expect(findElement(element, ContextFilter)).toBeUndefined();
  });
});
