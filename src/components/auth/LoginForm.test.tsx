import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { Component, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actions", () => ({ signIn }));

import { LoginForm } from "./LoginForm";

function renderForm(next?: string) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <LoginForm next={next} />
    </NextIntlClientProvider>,
  );
}

class CaughtBoundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function redirectError(): unknown {
  try {
    redirect("/dashboard");
  } catch (error) {
    return error;
  }
}

function submit(email: string) {
  fireEvent.change(screen.getByLabelText(messages.auth.login.email), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText(messages.auth.login.password), {
    target: { value: "mot-de-passe" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.login.submit }),
  );
}

beforeEach(() => {
  signIn.mockReset();
});

describe("formulaire de connexion", () => {
  it("propose e-mail et mot de passe avec les bons autocomplete", () => {
    renderForm();

    expect(
      screen
        .getByLabelText(messages.auth.login.email)
        .getAttribute("autocomplete"),
    ).toBe("email");
    expect(
      screen
        .getByLabelText(messages.auth.login.password)
        .getAttribute("autocomplete"),
    ).toBe("current-password");
  });

  it("transmet à l'action la page d'origine (session expirée), revalidée côté serveur", async () => {
    signIn.mockResolvedValue({ error: "invalidCredentials", email: "" });
    renderForm("/settings");

    submit("a@example.test");

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    const sent = signIn.mock.calls[0][1] as FormData;
    expect(sent.get("next")).toBe("/settings");
  });

  it("sans page d'origine, n'envoie pas de next", async () => {
    signIn.mockResolvedValue({ error: "invalidCredentials", email: "" });
    renderForm();

    submit("a@example.test");

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    const sent = signIn.mock.calls[0][1] as FormData;
    expect(sent.has("next")).toBe(false);
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

  it("un envoi rejeté affiche le message trop de tentatives dans le formulaire et garde l'e-mail", async () => {
    signIn.mockRejectedValue(
      new Error("An unexpected response was received from the server."),
    );
    renderForm();

    submit("a@example.test");

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.submitFailed,
      ),
    );
    expect(
      (screen.getByLabelText(messages.auth.login.email) as HTMLInputElement)
        .value,
    ).toBe("a@example.test");
  });

  it("n'avale pas une redirection de Next", async () => {
    const thrown = redirectError();
    signIn.mockRejectedValue(thrown);
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <CaughtBoundary onError={onError}>
        <NextIntlClientProvider locale="fr" messages={messages}>
          <LoginForm />
        </NextIntlClientProvider>
      </CaughtBoundary>,
    );

    submit("a@example.test");

    await waitFor(() => expect(onError).toHaveBeenCalledWith(thrown));
    expect(screen.queryByRole("alert")).toBeNull();
    consoleError.mockRestore();
  });
});
