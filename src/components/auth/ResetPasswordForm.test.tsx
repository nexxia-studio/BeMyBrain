import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
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
  actions.requestPasswordReset.mockResolvedValue({ step: "code", email: EMAIL });
  fireEvent.change(screen.getByLabelText(messages.auth.reset.email), {
    target: { value: EMAIL },
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.auth.reset.sendCode }),
  );
  await screen.findByLabelText(messages.auth.reset.code);
}

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
      screen.getByLabelText(messages.auth.reset.code).getAttribute("autocomplete"),
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
});
