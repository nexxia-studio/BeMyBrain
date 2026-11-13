import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

import { Sidebar } from "./Sidebar";

function renderSidebar(side: "private" | "pro") {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <Sidebar side={side} />
    </NextIntlClientProvider>,
  );
}

describe("barre latérale", () => {
  it("titre la navigation selon le côté affiché", () => {
    renderSidebar("pro");

    expect(screen.getByText("Vie pro")).toBeTruthy();
    expect(screen.queryByText("Vie privée")).toBeNull();
  });

  it("marque la section courante par aria-current", () => {
    renderSidebar("private");

    const home = screen.getByRole("link", { name: "Accueil" });

    expect(home.getAttribute("aria-current")).toBe("page");
    expect(home.getAttribute("href")).toBe("/dashboard");
  });

  it("place le filtre d'espace sous le titre du côté, avant les liens", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        <Sidebar side="pro" filter={<div data-testid="filtre" />} />
      </NextIntlClientProvider>,
    );

    const title = screen.getByText("Vie pro");
    const filter = screen.getByTestId("filtre");
    const home = screen.getByRole("link", { name: "Accueil" });

    expect(
      title.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      filter.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
