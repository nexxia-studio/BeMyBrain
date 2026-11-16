import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const requireSession = vi.hoisted(() => vi.fn());
const getLocale = vi.hoisted(() => vi.fn());
const pageHeader = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ requireSession }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("./actions", () => ({ setLocale: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale,
  getTranslations: async (namespace: "settings") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string; contextFilter?: boolean }) => {
    pageHeader(props);
    return <h1>{props.title}</h1>;
  },
}));

import SettingsPage from "./page";

async function renderPage() {
  const element = await SettingsPage();
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({
    userId: "dc42fa70-09a7-4038-a3bb-f61dda854910",
    workspaceId: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b",
    workspaceName: "BeMyBrain",
  });
  getLocale.mockResolvedValue("en");
});

describe("page Réglages", () => {
  it("ne rend rien sans session", async () => {
    requireSession.mockRejectedValue(new Error("REDIRECT:/login"));

    const render = SettingsPage();

    await expect(render).rejects.toThrow("REDIRECT:/login");
  });

  it("titre la page sans pastille de filtre d'espace", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Réglages" }),
    ).toBeTruthy();
    expect(pageHeader).toHaveBeenCalledWith({
      title: "Réglages",
      contextFilter: false,
    });
  });

  it("présélectionne la langue rendue", async () => {
    await renderPage();

    expect(
      screen
        .getByRole("button", { name: "English" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("propose la déconnexion dans la section Compte", async () => {
    await renderPage();

    const account = screen.getByRole("region", { name: "Compte" });

    expect(account.querySelector("form button[type=submit]")?.textContent).toBe(
      "Se déconnecter",
    );
  });
});
