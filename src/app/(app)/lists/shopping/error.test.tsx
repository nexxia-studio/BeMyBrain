import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/fr.json";

const reportClientError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ reportClientError }));

import ShoppingError from "./error";

function renderError(error: Error & { digest?: string }, retry = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ShoppingError error={error} retry={retry} />
    </NextIntlClientProvider>,
  );
  return retry;
}

beforeEach(() => reportClientError.mockClear());

describe("erreur de la liste de courses", () => {
  it("affiche un texte fixe traduit, jamais le message ni le digest", () => {
    renderError(
      Object.assign(new Error("panne lait demi-écrémé"), { digest: "987" }),
    );

    expect(
      screen.getByRole("heading", { name: messages.shopping.error.title }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("lait");
    expect(document.body.textContent).not.toContain("987");
  });

  it("Réessayer appelle retry (pas reset) et l'erreur part chez Sentry", () => {
    const error = new Error("x");
    const retry = renderError(error);

    const button = screen.getByRole("button", {
      name: messages.shopping.error.retry,
    });
    fireEvent.click(button);

    expect(retry).toHaveBeenCalledOnce();
    expect(reportClientError).toHaveBeenCalledWith(error);
    expect(button.className).toContain("min-h-11");
  });
});
