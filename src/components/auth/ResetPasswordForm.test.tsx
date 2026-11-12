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
