import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { buildDashboard } from "@/modules/dashboard/tiles";

import messages from "../../../messages/fr.json";

import { ShoppingTile } from "./ShoppingTile";

const PERSO = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  name: "Perso",
  color: "neutral",
} as const;
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;

function shoppingTile() {
  const tile = buildDashboard({
    side: "private",
    contexts: [PERSO],
    selected: [PERSO.id],
  }).tiles.find((t) => t.id === "shopping");
  if (!tile) throw new Error("tuile shopping absente");
  return tile;
}

function renderTile(summary: { count: number; first: string[] } | null) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ShoppingTile tile={shoppingTile()} summary={summary} />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("tile-shopping");
}

describe("tuile Courses", () => {
  it("affiche le nombre d'articles à acheter et les premiers", () => {
    const tile = renderTile({ count: 7, first: ["pommes", "lait", "pain"] });

    expect(within(tile).getByTestId("shopping-count").textContent).toBe("7");
    expect(
      within(tile)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["pommes", "lait", "pain"]);
    expect(within(tile).getByText("+ 4 autres")).toBeTruthy();
  });

  it("un tap ouvre /lists/shopping", () => {
    const tile = renderTile({ count: 2, first: ["pommes", "lait"] });

    const link = within(tile).getByRole("link");
    expect(link.getAttribute("href")).toBe("/lists/shopping");
    expect(link.className).toContain("min-h-11");
  });

  it("tuile vide propre : phrase, pas de chiffre, lien vers la liste", () => {
    const tile = renderTile({ count: 0, first: [] });

    expect(within(tile).getByText("Aucun article à acheter.")).toBeTruthy();
    expect(within(tile).queryByTestId("shopping-count")).toBeNull();
    expect(within(tile).getByRole("link").getAttribute("href")).toBe(
      "/lists/shopping",
    );
  });

  it("lecture en échec : un message, la tuile reste affichée", () => {
    const tile = renderTile(null);

    expect(within(tile).getByRole("status").textContent).toContain(
      "Courses indisponibles",
    );
  });

  it("n'apparaît pas côté Pro", () => {
    const pro = buildDashboard({
      side: "pro",
      contexts: [TRUSTUP],
      selected: [TRUSTUP.id],
    });

    expect(pro.tiles.map((t) => t.id)).not.toContain("shopping");
  });
});
