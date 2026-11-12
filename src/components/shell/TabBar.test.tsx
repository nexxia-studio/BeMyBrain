import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const pathname = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { TabBar } from "./TabBar";

function renderTabBar() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <TabBar />
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

  it("montre le bouton d'ajout, désactivé tant que la palette n'existe pas", () => {
    pathname.current = "/dashboard";

    renderTabBar();

    const add = screen.getByRole("button", { name: "Ajouter rapidement" });
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });
});
