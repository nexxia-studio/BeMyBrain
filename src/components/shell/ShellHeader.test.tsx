import { fireEvent, render, screen, within } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "app" | "shell") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

// Pilule Privé / Pro : testée à part (SideSwitch.test.tsx).
vi.mock("./SideSwitch", () => ({ SideSwitch: () => null }));

import { OpenPaletteContext } from "../command-palette/palette-context";
import { OpenQuickAddContext } from "../quick-add/quick-add-context";
import { ShellHeader } from "./ShellHeader";

async function renderHeader(openPalette = vi.fn(), openQuickAdd = vi.fn()) {
  // Composant serveur asynchrone : on attend son rendu avant de le monter.
  const element = await ShellHeader({ side: "private" });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <OpenPaletteContext value={openPalette}>
        <OpenQuickAddContext value={openQuickAdd}>
          {element}
        </OpenQuickAddContext>
      </OpenPaletteContext>
    </NextIntlClientProvider>,
  );
}

/** Vrai si l'élément ou un ancêtre est masqué à une largeur (classes Tailwind ; jsdom ne calcule pas le CSS). */
function hiddenOn(element: HTMLElement, width: "mobile" | "desktop") {
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const classes = node.classList;
    if (
      width === "mobile" &&
      classes.contains("hidden") &&
      !classes.contains("max-lg:hidden")
    )
      return true;
    if (width === "desktop" && classes.contains("lg:hidden")) return true;
  }
  return false;
}

describe("en-tête de la coque", () => {
  it("palette accessible sur mobile par un bouton de l'en-tête", async () => {
    const openPalette = vi.fn();
    await renderHeader(openPalette);

    const button = within(screen.getByRole("banner")).getByRole("button", {
      name: messages.shell.openPalette,
    });
    fireEvent.click(button);

    expect(hiddenOn(button, "mobile")).toBe(false);
    expect(hiddenOn(button, "desktop")).toBe(true);
    expect(openPalette).toHaveBeenCalledOnce();
  });

  it("sur ordinateur, la recherche ⌘K ouvre la palette", async () => {
    const openPalette = vi.fn();
    await renderHeader(openPalette);

    const search = within(screen.getByRole("banner")).getByRole("button", {
      name: new RegExp(messages.shell.search),
    });
    fireEvent.click(search);

    expect(hiddenOn(search, "mobile")).toBe(true);
    expect(hiddenOn(search, "desktop")).toBe(false);
    expect(openPalette).toHaveBeenCalledOnce();
  });

  it("sur ordinateur, le bouton d'ajout rond ouvre l'ajout rapide", async () => {
    const openQuickAdd = vi.fn();
    await renderHeader(vi.fn(), openQuickAdd);

    const add = within(screen.getByRole("banner")).getByRole("button", {
      name: messages.quickAdd.open,
    });
    fireEvent.click(add);

    expect(hiddenOn(add, "mobile")).toBe(true);
    expect(hiddenOn(add, "desktop")).toBe(false);
    expect(openQuickAdd).toHaveBeenCalledOnce();
  });
});
