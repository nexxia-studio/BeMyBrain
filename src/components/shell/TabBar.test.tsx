import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { OpenQuickAddContext } from "../quick-add/quick-add-context";
import { TabBar } from "./TabBar";

function renderTabBar(openQuickAdd = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <OpenQuickAddContext value={openQuickAdd}>
        <TabBar />
      </OpenQuickAddContext>
    </NextIntlClientProvider>,
  );
}

describe("barre d'onglets mobile", () => {
  it("marque l'onglet courant par aria-current", () => {
    pathname.current = "/dashboard";

    renderTabBar();

    expect(
      screen
        .getByRole("link", { name: "Accueil" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("ne marque aucun onglet hors de ses sections", () => {
    pathname.current = "/ailleurs";

    renderTabBar();

    expect(
      screen
        .getByRole("link", { name: "Accueil" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("propose l'onglet Réglages, de l'autre côté du bouton d'ajout, marqué sur ses sous-pages", () => {
    pathname.current = "/settings";

    renderTabBar();

    const settings = screen.getByRole("link", { name: "Réglages" });
    const add = screen.getByRole("button", { name: messages.quickAdd.open });
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(settings.getAttribute("aria-current")).toBe("page");
    expect(
      add.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("le + ouvre l'ajout rapide", () => {
    pathname.current = "/dashboard";
    const openQuickAdd = vi.fn();
    renderTabBar(openQuickAdd);

    const add = screen.getByRole("button", { name: messages.quickAdd.open });
    fireEvent.click(add);

    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(openQuickAdd).toHaveBeenCalledOnce();
  });
});
