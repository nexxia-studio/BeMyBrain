import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/fr.json";

const requireSessionWithToken = vi.hoisted(() => vi.fn());
const loadShoppingList = vi.hoisted(() => vi.fn());
const listProps = vi.hoisted(() => vi.fn());
const headerProps = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSessionWithToken }));
vi.mock("@/modules/shopping/load", () => ({ loadShoppingList }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "shopping") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string }) => {
    headerProps(props);
    return <h1>{props.title}</h1>;
  },
}));
vi.mock("@/components/shopping/QuickAddField", () => ({
  QuickAddField: () => <div data-testid="quick-add" />,
}));
vi.mock("@/components/shopping/ShoppingList", () => ({
  ShoppingList: (props: unknown) => {
    listProps(props);
    return <div data-testid="shopping-list" />;
  },
}));

import ShoppingPage from "./page";

const SESSION = { workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("page /lists/shopping", () => {
  it("lit la liste avec le jeton et le workspace de la session, sans filtre d'espace", async () => {
    const aisles = [{ aisleKey: "produce", items: [] }];
    requireSessionWithToken.mockResolvedValue({
      session: SESSION,
      token: "jeton",
    });
    loadShoppingList.mockResolvedValue({
      id: null,
      name: "Courses",
      rev: 0,
      aisles,
    });

    render(await ShoppingPage());

    expect(loadShoppingList).toHaveBeenCalledWith("jeton", SESSION.workspaceId);
    expect(screen.getByRole("heading", { name: "Courses" })).toBeTruthy();
    expect(headerProps).toHaveBeenCalledWith(
      expect.objectContaining({ contextFilter: false }),
    );
    expect(listProps).toHaveBeenCalledWith({
      aisles,
      quickAdd: expect.anything(),
    });
  });

  it("ne lit rien si la session est refusée", async () => {
    requireSessionWithToken.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(ShoppingPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(loadShoppingList).not.toHaveBeenCalled();
  });
});
