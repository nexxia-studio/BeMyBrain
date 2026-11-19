// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const readSide = vi.hoisted(() => vi.fn());
const loadContextFilter = vi.hoisted(() => vi.fn());
const loadCurrentScope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/preferences", () => ({ readSide }));
vi.mock("@/lib/context-filter", () => ({
  loadContextFilter,
  loadCurrentScope,
}));
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actions", () => ({ signOut }));

import { QuickAddProvider } from "@/components/quick-add/QuickAddProvider";
import { ContextFilter } from "@/components/shell/ContextFilter";
import { Sidebar } from "@/components/shell/Sidebar";

import AppLayout from "./layout";

const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

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

/** Filtre d'espace passé à la barre latérale (emplacement `filter`). */
function sidebarFilter(element: unknown): Element | undefined {
  return findElement(
    findElement(element, Sidebar)?.props.filter,
    ContextFilter,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({
    userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
    workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
    workspaceName: "BeMyBrain",
  });
  readSide.mockResolvedValue("private");
  loadContextFilter.mockResolvedValue(null);
  loadCurrentScope.mockResolvedValue({
    side: "private",
    contexts: [],
    contextId: null,
  });
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

describe("coque : côté et filtre d'espace", () => {
  it("sans choix d'espace sur le côté actif, la barre latérale n'a pas de filtre", async () => {
    const element = await AppLayout({ children: null });

    expect(sidebarFilter(element)).toBeUndefined();
  });

  it("place le filtre d'espace du côté actif dans la barre latérale", async () => {
    readSide.mockResolvedValue("pro");
    loadContextFilter.mockResolvedValue({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [NEXXIA.id],
    });

    const element = await AppLayout({ children: null });

    expect(sidebarFilter(element)?.props).toEqual({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [NEXXIA.id],
    });
  });

  it("propose aussi le filtre côté Privé quand il a un choix", async () => {
    loadContextFilter.mockResolvedValue({
      side: "private",
      contexts: [TRUSTUP, NEXXIA],
      selected: [TRUSTUP.id, NEXXIA.id],
    });

    const element = await AppLayout({ children: null });

    expect(sidebarFilter(element)?.props.side).toBe("private");
  });
});

describe("coque : ajout rapide", () => {
  it("donne à l'ajout rapide le côté et l'espace courants", async () => {
    const scope = {
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      contextId: TRUSTUP.id,
    };
    loadCurrentScope.mockResolvedValue(scope);

    const element = await AppLayout({ children: null });

    expect(findElement(element, QuickAddProvider)?.props.scope).toEqual(scope);
  });
});

/** Formulaires de déconnexion de l'arbre rendu (sans l'exécuter). */
function signOutForms(node: unknown): Element[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(signOutForms);
  const element = node as Element;
  const own =
    element.type === "form" && element.props.action === signOut
      ? [element]
      : [];
  return [
    ...own,
    ...signOutForms(element.props?.footer),
    ...signOutForms(element.props?.children),
  ];
}

describe("coque : déconnexion", () => {
  it("place la déconnexion en bas de la barre latérale seulement (sur mobile, elle est dans les Réglages)", async () => {
    const element = await AppLayout({ children: null });

    const forms = signOutForms(element);

    expect(forms).toHaveLength(1);
    expect(
      signOutForms(findElement(element, Sidebar)?.props.footer),
    ).toHaveLength(1);
  });
});
