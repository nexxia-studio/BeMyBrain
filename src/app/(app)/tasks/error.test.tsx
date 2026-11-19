import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/fr.json";

const reportClientError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-client", () => ({ reportClientError }));

import TasksError from "./error";

function renderError(error: Error & { digest?: string }, retry = vi.fn()) {
  render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <TasksError error={error} retry={retry} />
    </NextIntlClientProvider>,
  );
  return retry;
}

beforeEach(() => reportClientError.mockClear());

describe("erreur de la liste des tâches", () => {
  it("affiche un texte fixe traduit, jamais le message ni le digest de l'erreur", () => {
    renderError(
      Object.assign(new Error("panne Relancer le devis"), { digest: "987" }),
    );

    expect(
      screen.getByRole("heading", { name: "Tâches indisponibles" }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("Relancer le devis");
    expect(document.body.textContent).not.toContain("987");
  });

  it("Réessayer refait les requêtes (retry), et l'erreur part chez Sentry", () => {
    const error = new Error("x");
    const retry = renderError(error);

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(reportClientError).toHaveBeenCalledWith(error);
  });

  it("tuile d'erreur bornée comme la liste (max-w-3xl)", () => {
    renderError(new Error("panne"));

    const tile = screen.getByRole("heading", {
      name: "Tâches indisponibles",
    }).parentElement!;

    expect(tile.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["glass", "w-full", "max-w-3xl"]),
    );
  });
});
