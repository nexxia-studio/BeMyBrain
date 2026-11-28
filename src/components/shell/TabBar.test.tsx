import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { OpenQuickAddContext } from "../quick-add/quick-add-context";
import { TabBar } from "./TabBar";

function renderTabBar(openQuickAdd = vi.fn(), side: "private" | "pro" = "private") {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <OpenQuickAddContext value={openQuickAdd}>
        <TabBar side={side} />
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

  it("Listes : onglet côté Privé, absent côté Pro", () => {
    pathname.current = "/dashboard";
    const { unmount } = renderTabBar(vi.fn(), "private");
    expect(screen.getByRole("link", { name: messages.shell.lists })).toBeTruthy();
    unmount();

    renderTabBar(vi.fn(), "pro");
    expect(screen.queryByRole("link", { name: messages.shell.lists })).toBeNull();
  });
});
