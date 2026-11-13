import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const requireSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "dashboard") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son seul titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

import DashboardPage from "./page";

beforeEach(() => {
  requireSession.mockReset();
});

describe("tableau de bord", () => {
  it("affiche le nom du workspace résolu depuis la session", async () => {
    requireSession.mockResolvedValue({
      userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
      workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
      workspaceName: "Atelier Monie",
    });

    render(await DashboardPage());

    expect(screen.getByTestId("workspace-name").textContent).toBe(
      "Atelier Monie",
    );
  });

  it("titre la page par son en-tête", async () => {
    requireSession.mockResolvedValue({
      userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
      workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
      workspaceName: "Atelier Monie",
    });

    render(await DashboardPage());

    expect(
      screen.getByRole("heading", { level: 1, name: messages.dashboard.title }),
    ).toBeTruthy();
  });

  it("appelle elle-même requireSession (sans compter sur le layout)", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    const run = DashboardPage();

    await expect(run).rejects.toThrow("REDIRECT:/login");
  });
});
