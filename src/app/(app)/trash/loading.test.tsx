import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "trash") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

import TrashLoading from "./loading";

describe("chargement de la corbeille", () => {
  it("annonce le chargement et montre des lignes squelettes, sans texte inventé", async () => {
    render(await TrashLoading());

    expect(screen.getByRole("heading", { name: "Corbeille" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Chargement de la corbeille…",
    );
    expect(screen.getByTestId("trash-skeleton").textContent).toBe("");
  });
});
