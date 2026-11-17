import { render, screen, within } from "@testing-library/react";
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
import { ShellHeader } from "./ShellHeader";

async function renderHeader() {
  // Composant serveur asynchrone : on attend son rendu avant de le monter.
  const element = await ShellHeader({ side: "private" });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <OpenPaletteContext value={vi.fn()}>{element}</OpenPaletteContext>
    </NextIntlClientProvider>,
  );
}

describe("en-tête de la coque", () => {
  it("ouvre la palette par la seule recherche ⌘K, sans bouton « + » qui ferait doublon", async () => {
    await renderHeader();

    const header = screen.getByRole("banner");
    const buttons = within(header).getAllByRole("button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain(messages.shell.search);
    expect(
      within(header).queryByRole("button", {
        name: messages.shell.openPalette,
      }),
    ).toBeNull();
  });
});
