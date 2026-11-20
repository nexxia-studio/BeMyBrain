import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "dashboard") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

import DashboardLoading from "./loading";

describe("chargement du tableau de bord", () => {
  it("annonce le chargement et montre des tuiles squelettes, sans texte inventé", async () => {
    render(await DashboardLoading());

    expect(screen.getByRole("status").textContent).toBe(
      messages.dashboard.loading,
    );
    expect(screen.getByTestId("dashboard-skeleton").textContent).toBe("");
  });
});
