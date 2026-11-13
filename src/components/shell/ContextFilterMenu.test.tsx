import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const setContextSelection = vi.hoisted(() => vi.fn());

vi.mock("@/lib/preferences-actions", () => ({ setContextSelection }));

import { ContextFilterMenu } from "./ContextFilterMenu";

const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

function renderMenu(selected: string[]) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ContextFilterMenu
        side="pro"
        contexts={[TRUSTUP, NEXXIA]}
        selected={selected}
      />
    </NextIntlClientProvider>,
  );
}

function trigger() {
  return screen.getByRole("button", { name: /Espaces affichés/ });
}

async function openMenu() {
  fireEvent.click(trigger());
  return screen.findByRole("menu");
}

beforeEach(() => {
  vi.clearAllMocks();
  setContextSelection.mockResolvedValue(undefined);
});

describe("pastille de filtre d'espace (mobile)", () => {
  it("affiche l'espace retenu sur la pastille, menu fermé", () => {
    renderMenu([NEXXIA.id]);

    expect(trigger().textContent).toContain("Nexxia");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("affiche « Les deux » quand tous les espaces sont retenus", () => {
    renderMenu([TRUSTUP.id, NEXXIA.id]);

    expect(trigger().textContent).toContain("Les deux");
  });

  it("ouvre un menu qui propose « Les deux » puis chaque espace, le choix courant coché", async () => {
    renderMenu([NEXXIA.id]);

    const menu = await openMenu();

    const items = within(menu).getAllByRole("menuitemradio");
    expect(items.map((item) => item.textContent)).toEqual([
      "Les deux",
      "Trustup",
      "Nexxia",
    ]);
    expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("enregistre l'espace choisi pour le côté actif et ferme le menu", async () => {
    renderMenu([TRUSTUP.id, NEXXIA.id]);
    const menu = await openMenu();

    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Nexxia" }),
    );

    expect(setContextSelection).toHaveBeenCalledWith("pro", [NEXXIA.id]);
    expect(trigger().textContent).toContain("Nexxia");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("revient à tous les espaces avec « Les deux »", async () => {
    renderMenu([NEXXIA.id]);
    const menu = await openMenu();

    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Les deux" }),
    );

    expect(setContextSelection).toHaveBeenCalledWith("pro", null);
  });

  it("se ferme avec Échap et rend le focus à la pastille", async () => {
    renderMenu([NEXXIA.id]);
    const menu = await openMenu();

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("revient à l'espace enregistré et affiche un message si l'enregistrement échoue", async () => {
    setContextSelection.mockRejectedValue(new Error("réseau"));
    renderMenu([TRUSTUP.id, NEXXIA.id]);
    const menu = await openMenu();

    fireEvent.click(
      within(menu).getByRole("menuitemradio", { name: "Nexxia" }),
    );

    expect(
      await screen.findByText(messages.shell.preferenceError),
    ).toBeTruthy();
    await waitFor(() => expect(trigger().textContent).toContain("Les deux"));
  });
});
