import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AISLE_KEYS } from "@/modules/shopping/aisles";
import type { AisleGroup, ShoppingItem } from "@/modules/shopping/list-view";

import messages from "../../../messages/fr.json";

// Placement des popups : jsdom ne calcule aucune géométrie, on vérifie la consigne passée à Base UI (gotchas).
const positionerProps = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("@base-ui/react/menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@base-ui/react/menu")>();
  const { createElement } = await import("react");
  const Original = actual.Menu.Positioner;
  function Positioner(props: Record<string, unknown>) {
    positionerProps.push(props);
    return createElement(Original, props);
  }
  return { ...actual, Menu: { ...actual.Menu, Positioner } };
});

const actions = vi.hoisted(() => ({
  checkShoppingItem: vi.fn(),
  uncheckShoppingItem: vi.fn(),
  renameShoppingItem: vi.fn(),
  removeShoppingItem: vi.fn(),
  moveShoppingItemToAisle: vi.fn(),
  clearCheckedShoppingItems: vi.fn(),
  setShoppingAisleOrder: vi.fn(),
}));
vi.mock("@/app/(app)/lists/shopping/actions", () => actions);

import { chipPositionerProps } from "../tasks/chip-styles";
import { ItemMenu } from "./ItemMenu";
import { ShoppingList } from "./ShoppingList";

const ITEM: ShoppingItem = {
  id: "i1",
  label: "Truc inconnu",
  aisleKey: "other",
  checkedAt: null,
  addedByGuest: false,
};

function wrap(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {node}
    </NextIntlClientProvider>
  );
}

const triggerName = (label: string) => `Actions pour « ${label} »`;

async function openMenu(label = ITEM.label) {
  fireEvent.click(screen.getByRole("button", { name: triggerName(label) }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  actions.removeShoppingItem.mockResolvedValue({ ok: true, result: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  positionerProps.length = 0;
});

describe("ItemMenu", () => {
  it("le bouton fait 44 px et nomme l'article", () => {
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const trigger = screen.getByRole("button", {
      name: triggerName("Truc inconnu"),
    });
    expect(trigger.classList.contains("size-11")).toBe(true);
  });

  it("propose changer de rayon, renommer et supprimer, placés comme les autres menus", async () => {
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Changer de rayon", "Renommer", "Supprimer"]);
    expect(positionerProps.at(-1)).toMatchObject({
      ...chipPositionerProps,
      align: "end", // le bouton est au bord droit de la ligne
    });
  });

  it("Supprimer remet l'article à l'appelant, sans appel serveur lui-même", async () => {
    const onRemove = vi.fn();
    render(wrap(<ItemMenu item={ITEM} onRemove={onRemove} />));
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Supprimer" }));
    expect(onRemove).toHaveBeenCalledWith(ITEM);
    expect(actions.removeShoppingItem).not.toHaveBeenCalled();
  });

  it("changer de rayon : la feuille liste les rayons, le choix est envoyé puis la feuille se ferme", async () => {
    actions.moveShoppingItemToAisle.mockResolvedValue({
      ok: true,
      result: null,
    });
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Changer de rayon" }),
    );
    const sheet = await screen.findByRole("dialog", {
      name: "Changer de rayon",
    });
    // Le rayon actuel est marqué, chaque choix fait 44 px.
    const current = within(sheet).getByRole("button", { name: /Divers/ });
    expect(current.getAttribute("aria-current")).toBe("true");
    for (const b of within(sheet).getAllByRole("button", { name: /.+/ })) {
      if (b.hasAttribute("data-aisle")) {
        expect(b.classList.contains("min-h-11")).toBe(true);
      }
    }

    await act(async () => {
      fireEvent.click(
        within(sheet).getByRole("button", { name: /Épicerie salée/ }),
      );
    });
    expect(actions.moveShoppingItemToAisle).toHaveBeenCalledWith(
      "i1",
      "pantrySavory",
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("changer de rayon : l'échec garde la feuille ouverte avec un message", async () => {
    actions.moveShoppingItemToAisle.mockResolvedValue({ ok: false });
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Changer de rayon" }),
    );
    const sheet = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: /Boissons/ }));
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("choisir le rayon actuel ne fait aucun appel", async () => {
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(
      within(menu).getByRole("menuitem", { name: "Changer de rayon" }),
    );
    const sheet = await screen.findByRole("dialog");
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: /Divers/ }));
    });
    expect(actions.moveShoppingItemToAisle).not.toHaveBeenCalled();
  });

  it("renommer : le champ part du libellé, l'envoi appelle l'action avec le nouveau nom", async () => {
    actions.renameShoppingItem.mockResolvedValue({ ok: true, result: null });
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Renommer" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Renommer l'article",
    });
    const input = within(sheet).getByRole("textbox", {
      name: "Nom de l'article",
    }) as HTMLInputElement;
    expect(input.value).toBe("Truc inconnu");
    // Police ≥ 16 px (zoom iOS) et 80 caractères.
    expect(input.classList.contains("text-base")).toBe(true);
    expect(input.maxLength).toBe(80);

    fireEvent.change(input, { target: { value: "Sel fin" } });
    await act(async () => {
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Enregistrer" }),
      );
    });
    expect(actions.renameShoppingItem).toHaveBeenCalledWith("i1", "Sel fin");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("renommer : un nom vide ou inchangé n'appelle rien", async () => {
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Renommer" }));
    const sheet = await screen.findByRole("dialog");
    const input = within(sheet).getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Enregistrer" }),
      );
    });
    expect(actions.renameShoppingItem).not.toHaveBeenCalled();
  });

  it("renommer : un nom trop long refusé par le serveur est expliqué", async () => {
    actions.renameShoppingItem.mockResolvedValue({
      ok: false,
      code: "label_too_long",
    });
    render(wrap(<ItemMenu item={ITEM} onRemove={vi.fn()} />));
    const menu = await openMenu();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Renommer" }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByRole("textbox"), {
      target: { value: "Autre" },
    });
    await act(async () => {
      fireEvent.click(
        within(sheet).getByRole("button", { name: "Enregistrer" }),
      );
    });
    expect((await screen.findByRole("alert")).textContent).toMatch(/trop long/);
  });
});

// « Annuler » (spec Q12) : l'article disparaît tout de suite, la suppression n'est envoyée qu'après 5 s sans
// « Annuler » (aucune corbeille côté serveur) ; envoyée aussi dès qu'on quitte l'écran.
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
    aisleKey: "produce",
    items: [item("p1", "Pommes"), item("p2", "Carottes")],
  },
];

function renderList() {
  return render(wrap(<ShoppingList aisles={AISLES} order={[...AISLE_KEYS]} />));
}

/** Ouvre le menu de la ligne en temps réel, puis passe en faux temps pour le clic sur Supprimer. */
async function removeRow(label: string) {
  const menu = await openMenu(label);
  vi.useFakeTimers();
  fireEvent.click(within(menu).getByRole("menuitem", { name: "Supprimer" }));
}

describe("suppression d'un article avec « Annuler » 5 s", () => {
  it("l'article disparaît aussitôt, rien n'est envoyé avant 5 s", async () => {
    renderList();
    await removeRow("Pommes");
    expect(screen.queryByRole("checkbox", { name: "Pommes" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Carottes" })).toBeTruthy();
    expect(screen.getByTestId("removed-toast").textContent).toMatch(
      /« Pommes » supprimé/,
    );

    act(() => void vi.advanceTimersByTime(4900));
    expect(actions.removeShoppingItem).not.toHaveBeenCalled();
  });

  it("« Annuler » rend l'article dans les 5 s, à sa place, sans appel serveur", async () => {
    renderList();
    await removeRow("Pommes");
    act(() => void vi.advanceTimersByTime(3000));

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getAllByRole("checkbox").map((r) => r.textContent)).toEqual([
      "Pommes",
      "Carottes",
    ]);
    expect(screen.queryByTestId("removed-toast")).toBeNull();

    act(() => void vi.advanceTimersByTime(10_000));
    expect(actions.removeShoppingItem).not.toHaveBeenCalled();
  });

  it("sans « Annuler », la suppression part à 5 s", async () => {
    actions.removeShoppingItem.mockResolvedValue({ ok: true, result: null });
    renderList();
    await removeRow("Pommes");
    await act(async () => void vi.advanceTimersByTime(5000));
    expect(actions.removeShoppingItem).toHaveBeenCalledTimes(1);
    expect(actions.removeShoppingItem).toHaveBeenCalledWith("p1");
    expect(screen.queryByTestId("removed-toast")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Pommes" })).toBeNull();
  });

  it("quitter l'écran pendant les 5 s envoie la suppression tout de suite", async () => {
    actions.removeShoppingItem.mockResolvedValue({ ok: true, result: null });
    const { unmount } = renderList();
    await removeRow("Pommes");
    unmount();
    expect(actions.removeShoppingItem).toHaveBeenCalledWith("p1");
  });

  it("fermer l'onglet (pagehide) envoie aussi la suppression", async () => {
    actions.removeShoppingItem.mockResolvedValue({ ok: true, result: null });
    renderList();
    await removeRow("Pommes");
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(actions.removeShoppingItem).toHaveBeenCalledTimes(1);
  });

  it("supprimer un second article envoie le premier tout de suite", async () => {
    actions.removeShoppingItem.mockResolvedValue({ ok: true, result: null });
    renderList();
    await removeRow("Pommes");
    vi.useRealTimers();
    const menu = await openMenu("Carottes");
    vi.useFakeTimers();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Supprimer" }));
    expect(actions.removeShoppingItem).toHaveBeenCalledWith("p1");
    expect(actions.removeShoppingItem).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("removed-toast").textContent).toMatch(/Carottes/);
  });

  it("un refus du serveur rend l'article avec « Pas enregistré »", async () => {
    actions.removeShoppingItem.mockResolvedValue({ ok: false });
    renderList();
    await removeRow("Pommes");
    await act(async () => void vi.advanceTimersByTime(5000));
    vi.useRealTimers();
    expect(
      await screen.findByRole("checkbox", { name: "Pommes" }),
    ).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Pas enregistré/,
    );
  });
});
