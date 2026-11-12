import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actions", () => ({ signIn }));

import { LoginForm } from "./LoginForm";

function renderForm() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <LoginForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  signIn.mockReset();
});

describe("formulaire de connexion", () => {
  it("propose e-mail et mot de passe avec les bons autocomplete", () => {
    renderForm();

    expect(
      screen.getByLabelText(messages.auth.login.email).getAttribute("autocomplete"),
    ).toBe("email");
    expect(
      screen
        .getByLabelText(messages.auth.login.password)
        .getAttribute("autocomplete"),
    ).toBe("current-password");
  });

  it("n'affiche aucune erreur avant l'envoi", () => {
    renderForm();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche « identifiants invalides » quand l'action le renvoie", async () => {
    signIn.mockResolvedValue({
      error: "invalidCredentials",
      email: "a@example.test",
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(messages.auth.login.email), {
      target: { value: "a@example.test" },
    });
    fireEvent.change(screen.getByLabelText(messages.auth.login.password), {
      target: { value: "faux" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.login.submit }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.invalidCredentials,
      ),
    );
  });

  it("garde l'e-mail saisi après une erreur", async () => {
    signIn.mockResolvedValue({
      error: "invalidCredentials",
      email: "a@example.test",
    });
    renderForm();
    const email = screen.getByLabelText(
      messages.auth.login.email,
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "a@example.test" } });
    fireEvent.change(screen.getByLabelText(messages.auth.login.password), {
      target: { value: "faux" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.login.submit }),
    );

    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText(messages.auth.login.email) as HTMLInputElement)
        .value,
    ).toBe("a@example.test");
  });
});
