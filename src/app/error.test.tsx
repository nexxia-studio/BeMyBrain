import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import errors from "../../messages/errors/fr.json";
import fr from "../../messages/fr.json";

const reportClientError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ reportClientError }));

import ErrorPage from "./error";

// Messages tels que src/i18n/request.ts les fournit : section errors refusionnée.
const messages = { ...fr, errors };

function renderError(error: Error & { digest?: string }, retry = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ErrorPage error={error} retry={retry} />
    </NextIntlClientProvider>,
  );
  return retry;
}

beforeEach(() => {
  reportClientError.mockClear();
});

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

    fireEvent.click(
      screen.getByRole("button", { name: messages.errors.retry }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("envoie l'erreur à Sentry, chargé à la demande (rien si inactif : src/lib/sentry-client.ts)", () => {
    const error = new Error("x");

    renderError(error);

    expect(reportClientError).toHaveBeenCalledWith(error);
  });
});
