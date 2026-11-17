import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { Component, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/fr.json";

const actions = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("@/lib/auth/actions", () => actions);

import { ResetPasswordForm } from "./ResetPasswordForm";

const EMAIL = "a@example.test";

function renderForm() {
  return render(
    <NextIntlClientProvider locale="fr" messages={messages}>
      <ResetPasswordForm />
    </NextIntlClientProvider>,
  );
}

async function requestCode() {
  actions.requestPasswordReset.mockResolvedValue({
    step: "code",
    email: EMAIL,
  });
  fireEvent.change(screen.getByLabelText(messages.auth.reset.email), {
    target: { value: EMAIL },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.reset.sendCode }),
  );
  await screen.findByLabelText(messages.auth.reset.code);
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
    redirect("/login");
  } catch (error) {
    return error;
  }
}

function submitCode() {
  fireEvent.change(screen.getByLabelText(messages.auth.reset.code), {
    target: { value: "123456" },
  });
  fireEvent.change(screen.getByLabelText(messages.auth.reset.newPassword), {
    target: { value: "nouveau-mot-de-passe" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.reset.submit }),
  );
}

const rejected = () =>
  new Error("An unexpected response was received from the server.");

beforeEach(() => {
  actions.requestPasswordReset.mockReset();
  actions.resetPassword.mockReset();
});

describe("réinitialisation du mot de passe", () => {
  it("commence par demander l'e-mail, sans champ de code", () => {
    renderForm();

    expect(screen.getByLabelText(messages.auth.reset.email)).toBeDefined();
    expect(screen.queryByLabelText(messages.auth.reset.code)).toBeNull();
  });

  it("après l'envoi, demande le code et le nouveau mot de passe", async () => {
    renderForm();

    await requestCode();

    expect(screen.getByRole("status").textContent).toBe(
      messages.auth.reset.codeSent,
    );
    expect(
      screen
        .getByLabelText(messages.auth.reset.newPassword)
        .getAttribute("autocomplete"),
    ).toBe("new-password");
    expect(
      screen
        .getByLabelText(messages.auth.reset.code)
        .getAttribute("autocomplete"),
    ).toBe("one-time-code");
  });

  it("montre l'e-mail en lecture seule, reconnaissable comme identifiant", async () => {
    renderForm();

    await requestCode();

    const username = screen.getByLabelText(
      messages.auth.reset.email,
    ) as HTMLInputElement;
    expect(username.readOnly).toBe(true);
    expect(username.value).toBe(EMAIL);
    expect(username.getAttribute("autocomplete")).toBe("username");
  });

  it("garde l'e-mail saisi après une adresse refusée", async () => {
    actions.requestPasswordReset.mockResolvedValue({
      step: "email",
      email: "antoine@exemple",
      error: "invalidEmail",
    });
    renderForm();
    fireEvent.change(screen.getByLabelText(messages.auth.reset.email), {
      target: { value: "antoine@exemple" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.sendCode }),
    );

    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText(messages.auth.reset.email) as HTMLInputElement)
        .value,
    ).toBe("antoine@exemple");
  });

  it("permet de renvoyer un code après un code invalide", async () => {
    renderForm();
    await requestCode();
    actions.resetPassword.mockResolvedValue({
      step: "code",
      email: EMAIL,
      error: "invalidCode",
    });
    fireEvent.change(screen.getByLabelText(messages.auth.reset.code), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText(messages.auth.reset.newPassword), {
      target: { value: "nouveau-mot-de-passe" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.submit }),
    );
    await screen.findByRole("alert");
    actions.requestPasswordReset.mockClear();

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.resendCode }),
    );

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(actions.requestPasswordReset).toHaveBeenCalledTimes(1);
    const sent = actions.requestPasswordReset.mock.calls[0][1] as FormData;
    expect(sent.get("email")).toBe(EMAIL);
  });

  it("affiche « code invalide » quand l'action le renvoie", async () => {
    renderForm();
    await requestCode();
    actions.resetPassword.mockResolvedValue({
      step: "code",
      email: EMAIL,
      error: "invalidCode",
    });
    fireEvent.change(screen.getByLabelText(messages.auth.reset.code), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText(messages.auth.reset.newPassword), {
      target: { value: "nouveau-mot-de-passe" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.submit }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.invalidCode,
      ),
    );
  });

  it("un envoi rejeté à l'étape e-mail affiche le message trop de tentatives et garde l'e-mail", async () => {
    actions.requestPasswordReset.mockRejectedValue(rejected());
    renderForm();
    fireEvent.change(screen.getByLabelText(messages.auth.reset.email), {
      target: { value: EMAIL },
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.sendCode }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.submitFailed,
      ),
    );
    expect(screen.queryByLabelText(messages.auth.reset.code)).toBeNull();
    expect(
      (screen.getByLabelText(messages.auth.reset.email) as HTMLInputElement)
        .value,
    ).toBe(EMAIL);
  });

  it("un envoi rejeté à l'étape code affiche le message trop de tentatives et reste à l'étape code", async () => {
    renderForm();
    await requestCode();
    actions.resetPassword.mockRejectedValue(rejected());

    submitCode();

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.submitFailed,
      ),
    );
    expect(screen.getByLabelText(messages.auth.reset.code)).toBeDefined();
    expect(
      (screen.getByLabelText(messages.auth.reset.email) as HTMLInputElement)
        .value,
    ).toBe(EMAIL);
  });

  it("un renvoi de code rejeté affiche le message et reste à l'étape code", async () => {
    renderForm();
    await requestCode();
    actions.requestPasswordReset.mockRejectedValue(rejected());

    fireEvent.click(
      screen.getByRole("button", { name: messages.auth.reset.resendCode }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        messages.auth.errors.submitFailed,
      ),
    );
    expect(screen.getByLabelText(messages.auth.reset.code)).toBeDefined();
  });

  it("n'avale pas une redirection de Next", async () => {
    const thrown = redirectError();
    const onError = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <CaughtBoundary onError={onError}>
        <NextIntlClientProvider locale="fr" messages={messages}>
          <ResetPasswordForm />
        </NextIntlClientProvider>
      </CaughtBoundary>,
    );
    await requestCode();
    actions.resetPassword.mockRejectedValue(thrown);

    submitCode();

    await waitFor(() => expect(onError).toHaveBeenCalledWith(thrown));
    expect(screen.queryByRole("alert")).toBeNull();
    consoleError.mockRestore();
  });
});
