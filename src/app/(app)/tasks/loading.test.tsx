import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "tasks.list") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

import TasksLoading from "./loading";

describe("chargement de la liste des tâches", () => {
  it("annonce le chargement et montre des lignes squelettes, sans texte inventé", async () => {
    render(await TasksLoading());

    expect(screen.getByRole("status").textContent).toBe(
      "Chargement des tâches…",
    );
    expect(screen.getByTestId("tasks-skeleton").textContent).toBe("");
  });
});
