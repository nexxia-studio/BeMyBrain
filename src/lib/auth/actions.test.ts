// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeAuth = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signOut: vi.fn(),
  emailOtp: { sendVerificationOtp: vi.fn(), resetPassword: vi.fn() },
}));

vi.mock("./server", () => ({ getAuth: () => fakeAuth }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
} from "./actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const EMAIL = "antoine@example.test";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("connexion", () => {
  it("redirige vers /dashboard après une connexion réussie", async () => {
    fakeAuth.signIn.email.mockResolvedValue({ data: {}, error: null });

    const run = signIn(null, form({ email: EMAIL, password: "motdepasse" }));

    await expect(run).rejects.toThrow("REDIRECT:/dashboard");
    expect(fakeAuth.signIn.email).toHaveBeenCalledWith({
      email: EMAIL,
      password: "motdepasse",
    });
  });

  it("renvoie un message générique sans le message de l'auth", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 401, message: "User antoine@example.test not found" },
    });

    const state = await signIn(null, form({ email: EMAIL, password: "faux" }));

    expect(state).toEqual({ error: "invalidCredentials" });
  });

  it("n'appelle pas l'auth si l'e-mail est invalide", async () => {
    const state = await signIn(
      null,
      form({ email: "pas-un-email", password: "x" }),
    );

    expect(state).toEqual({ error: "invalidCredentials" });
    expect(fakeAuth.signIn.email).not.toHaveBeenCalled();
  });

  it("signale l'auth injoignable sans détail", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 502, code: "NETWORK_TIMEOUT", message: "timeout" },
    });

    const state = await signIn(null, form({ email: EMAIL, password: "x" }));

    expect(state).toEqual({ error: "unavailable" });
  });
});

describe("déconnexion", () => {
  it("ferme la session puis redirige vers /login", async () => {
    fakeAuth.signOut.mockResolvedValue({ data: {}, error: null });

    const run = signOut();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(fakeAuth.signOut).toHaveBeenCalled();
  });
});

describe("réinitialisation du mot de passe par code e-mail", () => {
  it("demande un code de type forget-password et passe à l'étape du code", async () => {
    fakeAuth.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: EMAIL }),
    );

    expect(fakeAuth.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
      email: EMAIL,
      type: "forget-password",
    });
    expect(state).toEqual({ step: "code", email: EMAIL });
  });

  it("passe à l'étape du code même si l'auth refuse, pour ne pas révéler si le compte existe", async () => {
    fakeAuth.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 400, message: "User not found" },
    });

    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: EMAIL }),
    );

    expect(state).toEqual({ step: "code", email: EMAIL });
  });

  it("refuse un e-mail invalide sans appeler l'auth", async () => {
    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: "pas-un-email" }),
    );

    expect(state).toEqual({ step: "email", error: "invalidEmail" });
    expect(fakeAuth.emailOtp.sendVerificationOtp).not.toHaveBeenCalled();
  });

  it("définit le nouveau mot de passe puis renvoie vers /login", async () => {
    fakeAuth.emailOtp.resetPassword.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const run = resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: "123456", password: "nouveau-mot-de-passe" }),
    );

    await expect(run).rejects.toThrow("REDIRECT:/login?reset=done");
    expect(fakeAuth.emailOtp.resetPassword).toHaveBeenCalledWith({
      email: EMAIL,
      otp: "123456",
      password: "nouveau-mot-de-passe",
    });
  });

  it("un code refusé reste à l'étape du code avec un message générique", async () => {
    fakeAuth.emailOtp.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_OTP", message: "Invalid OTP" },
    });

    const state = await resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: "000000", password: "nouveau-mot-de-passe" }),
    );

    expect(state).toEqual({ step: "code", email: EMAIL, error: "invalidCode" });
  });

  it("refuse un mot de passe de moins de 8 caractères sans appeler l'auth", async () => {
    const state = await resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: "123456", password: "court" }),
    );

    expect(state).toEqual({
      step: "code",
      email: EMAIL,
      error: "weakPassword",
    });
    expect(fakeAuth.emailOtp.resetPassword).not.toHaveBeenCalled();
  });
});
