import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../messages/fr.json";

import Home from "./page";

function renderHome() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <Home />
    </NextIntlClientProvider>,
  );
}

describe("page d'accueil", () => {
  it("affiche la page d'accueil sans erreur", () => {
    renderHome();

    expect(screen.getByRole("main")).toBeDefined();
  });

  it("affiche le nom de l'app depuis les messages", () => {
    renderHome();

    expect(
      screen.getByRole("heading", { level: 1, name: messages.app.name }),
    ).toBeDefined();
  });
});
