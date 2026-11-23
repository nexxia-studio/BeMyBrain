import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { buildDashboard } from "@/modules/dashboard/tiles";

import messages from "../../../messages/fr.json";

import { EmptyTile } from "./EmptyTile";
import { TileCompactEmpty } from "./TileCompactEmpty";
import { GLASS_TILE_BODY_CLASSES, tileClasses } from "./tile-sizes";

const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  color: "indigo",
} as const;

// Aucune tuile vide du catalogue ne mêle encore plusieurs espaces : la tuile Clients reçoit ici les
// étiquettes qu'une tuile qui les mêle porterait.
const clientsWithLabels = () => {
  const tile = buildDashboard({
    side: "pro",
    contexts: [TRUSTUP, NEXXIA],
    selected: [TRUSTUP.id, NEXXIA.id],
  }).tiles.find((t) => t.id === "clients");
  if (!tile) throw new Error("tuile clients absente du catalogue");
  return {
    ...tile,
    spaceLabels: [
      { name: TRUSTUP.name, color: TRUSTUP.color },
      { name: NEXXIA.name, color: NEXXIA.color },
    ],
  };
};

describe("tuile vide", () => {
  it("espaces nommés dans leur couleur : Trustup chip-warm, Nexxia chip-indigo", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <EmptyTile tile={clientsWithLabels()} />
      </NextIntlClientProvider>,
    );

    const spaces = within(screen.getByTestId("tile-clients")).getByRole(
      "list",
      { name: "Espaces couverts" },
    );
    const classes = (name: string) =>
      within(spaces).getByText(name).className.split(/\s+/);
    expect(classes("Trustup")).toEqual(
      expect.arrayContaining(["bg-chip-warm", "text-chip-warm-foreground"]),
    );
    expect(classes("Nexxia")).toEqual(
      expect.arrayContaining(["bg-chip-indigo", "text-chip-indigo-foreground"]),
    );
  });

  it.each(["wide", "standard", "figure"] as const)(
    "tuile %s à la hauteur de son contenu : classes de place de tile-sizes.ts, aucune hauteur, état vide non poussé en bas",
    (size) => {
      render(
        <NextIntlClientProvider locale="fr" messages={messages}>
          <EmptyTile tile={{ ...clientsWithLabels(), size }} />
        </NextIntlClientProvider>,
      );

      const tile = screen.getByTestId("tile-clients");
      for (const name of tileClasses(size).split(" ")) {
        expect(tile.classList.contains(name)).toBe(true);
      }
      const classes = [tile, ...tile.querySelectorAll("*")].flatMap((element) =>
        Array.from(element.classList),
      );
      expect(
        classes.filter((name) => /(^|:)(min-|max-)?h-/.test(name)),
      ).toEqual([]);
      // Aucune action dans une tuile vide hors To-do : rien à pousser en bas.
      expect(classes).not.toContain("mt-auto");
      expect(classes).not.toContain("flex-1");
      expect(tile.dataset.tile).toBe("clients");
    },
  );

  it("état vide compact : le corps vient de TileCompactEmpty, partagé avec le givre de chargement", () => {
    const tile = { ...clientsWithLabels(), spaceLabels: [] };
    const real = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <EmptyTile tile={tile} />
      </NextIntlClientProvider>,
    );
    const surface = real.getByTestId("tile-clients").querySelector("section");
    const shared = render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <div className={GLASS_TILE_BODY_CLASSES}>
          <TileCompactEmpty tile={tile} />
        </div>
      </NextIntlClientProvider>,
    ).container.firstElementChild;

    for (const name of GLASS_TILE_BODY_CLASSES.split(" ")) {
      expect(surface?.classList.contains(name)).toBe(true);
    }
    // Premier enfant de la surface : le calque du reflet ; le reste est le corps partagé.
    const body = Array.from(surface?.children ?? []).slice(1);
    expect(body.map((element) => element.outerHTML)).toEqual(
      Array.from(shared?.children ?? []).map((element) => element.outerHTML),
    );
  });

  it("les espaces tiennent sur une ligne (pastilles tronquées, sans retour à la ligne)", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <EmptyTile tile={clientsWithLabels()} />
      </NextIntlClientProvider>,
    );

    const spaces = within(screen.getByTestId("tile-clients")).getByRole(
      "list",
      { name: "Espaces couverts" },
    );
    expect(spaces.classList.contains("flex-nowrap")).toBe(true);
    expect(spaces.classList.contains("overflow-hidden")).toBe(true);
    expect(
      within(spaces).getByText("Trustup").classList.contains("truncate"),
    ).toBe(true);
  });
});
