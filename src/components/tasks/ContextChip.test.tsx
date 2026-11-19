import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

import { ContextChip } from "./ContextChip";

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

function renderChip(value: string | null) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ContextChip
        contexts={[TRUSTUP, NEXXIA]}
        value={value}
        onChange={vi.fn()}
        disabled={false}
      />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("button", { name: /^Espace :/ });
}

const classes = (element: Element) => element.className.split(/\s+/);

describe("pastille Espace", () => {
  it("prend la classe chip-warm pour un espace warm", () => {
    const chip = renderChip(TRUSTUP.id);

    expect(classes(chip)).toEqual(
      expect.arrayContaining(["bg-chip-warm", "text-chip-warm-foreground"]),
    );
    expect(classes(chip)).not.toContain("bg-secondary");
  });

  it("sans espace choisi, garde le style des autres pastilles", () => {
    const chip = renderChip(null);

    expect(classes(chip)).toContain("bg-secondary");
    expect(chip.className).not.toMatch(/bg-chip-/);
  });

  it("dans le menu, chaque espace porte sa pastille", async () => {
    fireEvent.click(renderChip(null));

    const nexxia = await screen.findByText("Nexxia");
    expect(classes(nexxia)).toEqual(
      expect.arrayContaining(["bg-chip-indigo", "text-chip-indigo-foreground"]),
    );
    expect(classes(screen.getByText("Trustup"))).toContain("bg-chip-warm");
  });
});
