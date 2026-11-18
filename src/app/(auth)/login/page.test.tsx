import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const hasActiveSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock("@/lib/session", () => ({ hasActiveSession }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders.current),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "auth") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// Formulaire : testé à part (LoginForm.test.tsx), remplacé ici par un témoin qui expose son `next`.
vi.mock("@/components/auth/LoginForm", () => ({
  LoginForm: ({ next }: { next?: string }) => (
    <form data-testid="login-form" data-next={next ?? ""} />
  ),
}));

import LoginPage from "./page";

function renderPage(params: Record<string, string> = {}) {
  return LoginPage({ searchParams: Promise.resolve(params) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestHeaders.current = new Headers({
    host: "bemybrain.test",
    "x-forwarded-proto": "https",
  });
  hasActiveSession.mockResolvedValue(false);
});

describe("/login (QA-2)", () => {
  it("sans session, affiche le formulaire", async () => {
    render(await renderPage());

    expect(screen.queryByTestId("login-form")).not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("avec une session valide, renvoie vers le tableau de bord", async () => {
    hasActiveSession.mockResolvedValue(true);

    const run = renderPage();

    await expect(run).rejects.toThrow(/^REDIRECT:\/dashboard$/);
  });

  it("avec une session valide et un next interne, renvoie vers ce chemin", async () => {
    hasActiveSession.mockResolvedValue(true);

    const run = renderPage({ next: "/settings" });

    await expect(run).rejects.toThrow(/^REDIRECT:\/settings$/);
  });

  it.each([
    ["autre origine", "https://autre.test/settings"],
    ["chemin protocole-relatif", "//autre.test"],
    ["barre oblique inverse", "/\\autre.test"],
    ["/login lui-même", "/login"],
  ])(
    "avec une session valide et un next refusé (%s), renvoie vers le tableau de bord",
    async (_, next) => {
      hasActiveSession.mockResolvedValue(true);

      const run = renderPage({ next });

      await expect(run).rejects.toThrow(/^REDIRECT:\/dashboard$/);
    },
  );

  it("session refusée ou auth indisponible (hasActiveSession faux) : le formulaire s'affiche, avec le next retenu", async () => {
    hasActiveSession.mockResolvedValue(false);

    render(await renderPage({ next: "/settings" }));

    expect(screen.getByTestId("login-form").dataset.next).toBe("/settings");
    expect(redirect).not.toHaveBeenCalled();
  });
});
