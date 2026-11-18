import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

import GlobalError from "./global-error";

// global-error rend son propre <html> : rendu directement dans le document, comme Next.
function renderGlobalError(error: unknown, retry = vi.fn()) {
  render(<GlobalError error={error} retry={retry} />, { container: document });
  return retry;
}

beforeEach(() => {
  captureException.mockClear();
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-BE"]);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("lang");
});

describe("page d'erreur globale", () => {
  it("affiche un texte fixe traduit, jamais le message ni le digest de l'erreur", () => {
    const error = Object.assign(new Error("panne dc42fa70 jeton eyJ"), {
      digest: "4242",
    });

    renderGlobalError(error);

    expect(
      screen.getByRole("heading", { level: 1, name: fr.errors.title }),
    ).toBeDefined();
    expect(document.body.textContent).not.toContain("panne dc42fa70");
    expect(document.body.textContent).not.toContain("4242");
  });

  it("parle la langue de la page qu'elle remplace (<html lang> du layout racine)", () => {
    document.documentElement.lang = "en";

    renderGlobalError(new Error("x"));

    expect(
      screen.getByRole("heading", { level: 1, name: en.errors.title }),
    ).toBeDefined();
    expect(document.documentElement.lang).toBe("en");
  });

  it("le bouton réessayer relance le rendu (retry)", () => {
    const retry = renderGlobalError(new Error("x"));

    fireEvent.click(screen.getByRole("button", { name: fr.errors.retry }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("envoie l'erreur à Sentry", () => {
    const error = new Error("x");

    renderGlobalError(error);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});
