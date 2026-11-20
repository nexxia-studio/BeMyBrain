import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { buildDashboard } from "@/modules/dashboard/tiles";

import messages from "../../../messages/fr.json";

import { EmptyTile } from "./EmptyTile";

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
});
