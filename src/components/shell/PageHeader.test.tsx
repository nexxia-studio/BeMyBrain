import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const loadContextFilter = vi.hoisted(() => vi.fn());

vi.mock("@/lib/context-filter", () => ({ loadContextFilter }));
vi.mock("@/lib/preferences-actions", () => ({ setContextSelection: vi.fn() }));

import { PageHeader } from "./PageHeader";

const TRUSTUP = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", name: "Trustup" };
const NEXXIA = { id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d", name: "Nexxia" };

async function renderHeader() {
  // Composant serveur asynchrone : on attend son rendu avant de le monter.
  const element = await PageHeader({ title: "Tableau de bord" });
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("en-tête de page", () => {
  it("rend le titre de page en h1", async () => {
    loadContextFilter.mockResolvedValue(null);

    await renderHeader();

    expect(
      screen.getByRole("heading", { level: 1, name: "Tableau de bord" }),
    ).toBeTruthy();
  });

  it("place la pastille du filtre d'espace à côté du titre quand le côté a un choix", async () => {
    loadContextFilter.mockResolvedValue({
      side: "pro",
      contexts: [TRUSTUP, NEXXIA],
      selected: [TRUSTUP.id],
    });

    await renderHeader();

    expect(
      screen.getByRole("button", { name: /Espaces affichés/ }).textContent,
    ).toContain("Trustup");
  });

  it("n'affiche aucune pastille quand le côté a moins de deux espaces", async () => {
    loadContextFilter.mockResolvedValue(null);

    await renderHeader();

    expect(screen.queryByRole("button")).toBeNull();
  });
});
