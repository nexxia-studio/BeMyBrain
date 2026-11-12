import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const getSession = vi.hoisted(() => vi.fn());
const requireSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/server", () => ({ getSession }));
vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "noWorkspace") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

import NoWorkspacePage from "./page";

beforeEach(() => {
  getSession.mockReset();
  requireSession.mockReset();
});

describe("page sans workspace", () => {
  it("affiche un message traduit et la déconnexion, sans résoudre de workspace", async () => {
    getSession.mockResolvedValue({
      user: { id: "dc42fa70-09a7-4038-a3bb-f61dda854910" },
    });

    render(
      <NextIntlClientProvider locale="fr" messages={messages}>
        {await NoWorkspacePage()}
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: messages.noWorkspace.title }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: messages.auth.signOut }),
    ).toBeDefined();
    // Pas de boucle : la page n'appelle pas requireSession, qui renverrait ici.
    expect(requireSession).not.toHaveBeenCalled();
  });

  it("sans session, redirige vers /login", async () => {
    getSession.mockResolvedValue(null);

    const run = NoWorkspacePage();

    await expect(run).rejects.toThrow("REDIRECT:/login");
  });
});
