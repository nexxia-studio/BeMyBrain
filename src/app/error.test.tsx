import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "../../messages/fr.json";

import ErrorPage from "./error";

function renderError(error: Error & { digest?: string }, retry = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ErrorPage error={error} retry={retry} />
    </NextIntlClientProvider>,
  );
  return retry;
}

describe("page d'erreur", () => {
  it("affiche un texte fixe traduit, jamais le message de l'erreur", () => {
    const error = Object.assign(new Error("panne dc42fa70 jeton eyJ"), {
      digest: "123",
    });

    renderError(error);

    expect(
      screen.getByRole("heading", { level: 1, name: messages.errors.title }),
    ).toBeDefined();
    expect(document.body.textContent).not.toContain("panne dc42fa70");
    expect(document.body.textContent).not.toContain("123");
  });

  it("le bouton réessayer relance le segment (retry)", () => {
    const retry = renderError(new Error("x"));

    fireEvent.click(screen.getByRole("button", { name: messages.errors.retry }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
