import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AisleGroup, ShoppingItem } from "@/modules/shopping/list-view";

import messages from "../../../messages/fr.json";

const checkShoppingItem = vi.hoisted(() => vi.fn());
const uncheckShoppingItem = vi.hoisted(() => vi.fn());
vi.mock("@/app/(app)/lists/shopping/actions", () => ({
  removeShoppingItem: vi.fn(),
  checkShoppingItem,
  uncheckShoppingItem,
}));

import { ShoppingList } from "./ShoppingList";

function item(id: string, label: string, over: Partial<ShoppingItem> = {}) {
  return {
    id,
    label,
    aisleKey: "produce",
    checkedAt: null,
    addedByGuest: false,
    ...over,
  } satisfies ShoppingItem;
}

const AISLES: AisleGroup[] = [
  {
    aisleKey: "drinks",
    items: [item("b1", "Eau", { aisleKey: "drinks" })],
  },
  {
    aisleKey: "produce",
    items: [
      item("p1", "Pommes"),
      item("p2", "Carottes"),
      item("p3", "Poires", { checkedAt: new Date("2026-11-20T10:00:00Z") }),
    ],
  },
];

function renderList(aisles: AisleGroup[] = AISLES, quickAdd?: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ShoppingList aisles={aisles} quickAdd={quickAdd} />
    </NextIntlClientProvider>,
  );
}

const rowLabels = (section: HTMLElement) =>
  within(section)
    .getAllByRole("checkbox")
    .map((row) => row.textContent);

// Un appel laissé en attente retient les transitions des tests suivants (gotchas) : résolu en fin de test.
const open: Array<() => void> = [];
function pendingCall(mock: ReturnType<typeof vi.fn>) {
  mock.mockReturnValue(
    new Promise((resolve) =>
      open.push(() => resolve({ ok: true, result: null })),
    ),
  );
}

afterEach(async () => {
  await act(async () => {
    for (const resolve of open.splice(0)) resolve();
  });
  vi.clearAllMocks();
});

describe("ShoppingList", () => {
  it("n'affiche que les rayons reçus, dans l'ordre de l'utilisateur", () => {
    renderList();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      expect.stringContaining("Boissons"),
      expect.stringContaining("Fruits et légumes"),
    ]);
    expect(screen.queryByText("Surgelés")).toBeNull();
  });

  it("un tap coche (barré, grisé) et l'article descend en bas du rayon, avant tout await", () => {
    pendingCall(checkShoppingItem);
    renderList();
    const section = screen.getByRole("region", { name: /Fruits et légumes/ });
    expect(rowLabels(section)).toEqual(["Pommes", "Carottes", "Poires"]);

    fireEvent.click(within(section).getByRole("checkbox", { name: "Pommes" }));

    // Aucun await : l'état optimiste est déjà là.
    expect(checkShoppingItem).toHaveBeenCalledWith("p1");
    expect(rowLabels(section)).toEqual(["Carottes", "Poires", "Pommes"]);
    const pommes = within(section).getByRole("checkbox", { name: "Pommes" });
    expect(pommes.getAttribute("aria-checked")).toBe("true");
    expect(pommes.classList.contains("line-through")).toBe(true);
  });

  it("un tap sur un article coché le décoche", () => {
    pendingCall(uncheckShoppingItem);
    renderList();
    const poires = screen.getByRole("checkbox", { name: "Poires" });
    expect(poires.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(poires);
    expect(uncheckShoppingItem).toHaveBeenCalledWith("p3");
    expect(
      screen
        .getByRole("checkbox", { name: "Poires" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("l'échec rend l'article à son état et affiche « Pas enregistré »", async () => {
    checkShoppingItem.mockResolvedValue({ ok: false });
    renderList();
    const section = screen.getByRole("region", { name: /Fruits et légumes/ });
    await act(async () => {
      fireEvent.click(
        within(section).getByRole("checkbox", { name: "Pommes" }),
      );
    });
    await waitFor(() =>
      expect(rowLabels(section)).toEqual(["Pommes", "Carottes", "Poires"]),
    );
    expect(
      within(section)
        .getByRole("checkbox", { name: "Pommes" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
  });

  it("une action qui lève rend aussi l'article à son état avec le message", async () => {
    checkShoppingItem.mockRejectedValue(new Error("panne"));
    renderList();
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Pommes" }));
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
  });

  it("ignore un second tap sur l'article tant que l'appel est en cours", () => {
    pendingCall(checkShoppingItem);
    renderList();
    const row = screen.getByRole("checkbox", { name: "Pommes" });
    fireEvent.click(row);
    fireEvent.click(screen.getByRole("checkbox", { name: "Pommes" }));
    expect(checkShoppingItem).toHaveBeenCalledTimes(1);
    expect(uncheckShoppingItem).not.toHaveBeenCalled();
  });

  it("zone tactile d'au moins 44 px sur chaque ligne", () => {
    renderList();
    for (const row of screen.getAllByRole("checkbox")) {
      expect(row.classList.contains("min-h-11")).toBe(true);
    }
  });

  it("« Vider les cochés » n'apparaît que s'il y a des cochés, avec leur nombre", () => {
    const { unmount } = renderList();
    expect(
      screen.getByRole("button", { name: "Vider les cochés (1)" }),
    ).toBeTruthy();
    unmount();
    renderList([{ aisleKey: "produce", items: [item("p1", "Pommes")] }]);
    expect(
      screen.queryByRole("button", { name: /Vider les cochés/ }),
    ).toBeNull();
  });

  it("chaque ligne a son menu de 44 px", () => {
    renderList();
    expect(
      screen.getAllByRole("button", { name: /^Actions pour/ }),
    ).toHaveLength(4);
  });

  it("état vide : une phrase, aucun rayon, et le champ d'ajout reste là", () => {
    renderList([], <input aria-label="Ajouter" />);
    expect(screen.getByText(messages.shopping.list.empty)).toBeTruthy();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.getByLabelText("Ajouter")).toBeTruthy();
  });
});
