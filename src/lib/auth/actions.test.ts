// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeAuth = vi.hoisted(() => ({
  signIn: { email: vi.fn() },
  signOut: vi.fn(),
  emailOtp: { sendVerificationOtp: vi.fn(), resetPassword: vi.fn() },
}));
const cookieStore = vi.hoisted(() => ({
  getAll: vi.fn(),
  set: vi.fn(),
}));

const syncSessionLocale = vi.hoisted(() => vi.fn());

vi.mock("./server", () => ({ getAuth: () => fakeAuth }));
vi.mock("@/lib/session", () => ({ syncSessionLocale }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
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
const OTP = "482913";

let warn: ReturnType<typeof vi.spyOn>;

function logged() {
  return JSON.stringify(warn.mock.calls);
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.getAll.mockReturnValue([]);
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
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

  it("après connexion réussie, recopie la langue enregistrée avant de rediriger", async () => {
    fakeAuth.signIn.email.mockResolvedValue({ data: {}, error: null });

    const run = signIn(null, form({ email: EMAIL, password: "motdepasse" }));

    await expect(run).rejects.toThrow("REDIRECT:/dashboard");
    expect(syncSessionLocale).toHaveBeenCalledTimes(1);
  });

  it("ne touche pas à la langue si la connexion échoue", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 401 },
    });

    await signIn(null, form({ email: EMAIL, password: "faux" }));

    expect(syncSessionLocale).not.toHaveBeenCalled();
  });

  it("renvoie un message générique sans le message de l'auth, et garde l'e-mail saisi", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 401, message: `User ${EMAIL} not found` },
    });

    const state = await signIn(null, form({ email: EMAIL, password: "faux" }));

    expect(state).toEqual({ error: "invalidCredentials", email: EMAIL });
  });

  it("journalise statut et code de l'échec, sans l'e-mail ni le mot de passe", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: `User ${EMAIL} not found`,
      },
    });

    await signIn(null, form({ email: EMAIL, password: "secret-saisi" }));

    expect(logged()).toContain("401");
    expect(logged()).toContain("INVALID_EMAIL_OR_PASSWORD");
    expect(logged()).not.toContain(EMAIL);
    expect(logged()).not.toContain("secret-saisi");
  });

  it("ne journalise pas un code d'erreur hors format", async () => {
    fakeAuth.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 400, code: `bad ${EMAIL}` },
    });

    await signIn(null, form({ email: EMAIL, password: "x" }));

    expect(logged()).not.toContain(EMAIL);
  });

  it("n'appelle pas l'auth si l'e-mail est invalide", async () => {
    const state = await signIn(
      null,
      form({ email: "pas-un-email", password: "x" }),
    );

    expect(state).toEqual({
      error: "invalidCredentials",
      email: "pas-un-email",
    });
    expect(fakeAuth.signIn.email).not.toHaveBeenCalled();
  });

  it.each([
    ["l'auth injoignable", { status: 502, code: "NETWORK_TIMEOUT" }],
    ["une erreur 500", { status: 500 }],
    ["une erreur 503", { status: 503 }],
    ["trop de tentatives (429)", { status: 429 }],
  ])("signale le service indisponible pour %s", async (_label, error) => {
    fakeAuth.signIn.email.mockResolvedValue({ data: null, error });

    const state = await signIn(null, form({ email: EMAIL, password: "x" }));

    expect(state).toEqual({ error: "unavailable", email: EMAIL });
  });
});

describe("déconnexion", () => {
  const sdkCookies = [
    { name: "__Secure-neon-auth.session_token", value: "a" },
    { name: "__Secure-neon-auth.local.session_data", value: "b" },
  ];

  it("ferme la session, supprime les cookies de l'auth puis redirige vers /login", async () => {
    fakeAuth.signOut.mockResolvedValue({ data: {}, error: null });
    cookieStore.getAll.mockReturnValue([
      ...sdkCookies,
      { name: "NEXT_LOCALE", value: "fr" },
    ]);

    const run = signOut();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(fakeAuth.signOut).toHaveBeenCalled();
    expect(cookieStore.set.mock.calls.map(([name]) => name)).toEqual(
      sdkCookies.map((c) => c.name),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "__Secure-neon-auth.session_token",
      "",
      expect.objectContaining({ maxAge: 0, path: "/", secure: true }),
    );
  });

  it("supprime les cookies et journalise même si l'auth renvoie une erreur", async () => {
    fakeAuth.signOut.mockResolvedValue({
      data: null,
      error: { status: 503 },
    });
    cookieStore.getAll.mockReturnValue(sdkCookies);

    const run = signOut();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(cookieStore.set).toHaveBeenCalledTimes(2);
    expect(logged()).toContain("503");
  });

  it("supprime les cookies même si l'appel à l'auth lève une exception", async () => {
    fakeAuth.signOut.mockRejectedValue(new TypeError("fetch failed"));
    cookieStore.getAll.mockReturnValue(sdkCookies);

    const run = signOut();

    await expect(run).rejects.toThrow("REDIRECT:/login");
    expect(cookieStore.set).toHaveBeenCalledTimes(2);
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

  it("passe à l'étape du code même si l'auth refuse, et journalise sans l'e-mail", async () => {
    fakeAuth.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 400, code: "USER_NOT_FOUND", message: EMAIL },
    });

    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: EMAIL }),
    );

    expect(state).toEqual({ step: "code", email: EMAIL });
    expect(logged()).toContain("400");
    expect(logged()).not.toContain(EMAIL);
  });

  it("signale le service indisponible sur une erreur 429", async () => {
    fakeAuth.emailOtp.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 429 },
    });

    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: EMAIL }),
    );

    expect(state).toEqual({
      step: "email",
      email: EMAIL,
      error: "unavailable",
    });
  });

  it("refuse un e-mail invalide sans appeler l'auth, et le garde", async () => {
    const state = await requestPasswordReset(
      { step: "email" },
      form({ email: "pas-un-email" }),
    );

    expect(state).toEqual({
      step: "email",
      email: "pas-un-email",
      error: "invalidEmail",
    });
    expect(fakeAuth.emailOtp.sendVerificationOtp).not.toHaveBeenCalled();
  });

  it("définit le nouveau mot de passe puis renvoie vers /login", async () => {
    fakeAuth.emailOtp.resetPassword.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const run = resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: OTP, password: "nouveau-mot-de-passe" }),
    );

    await expect(run).rejects.toThrow("REDIRECT:/login?reset=done");
    expect(fakeAuth.emailOtp.resetPassword).toHaveBeenCalledWith({
      email: EMAIL,
      otp: OTP,
      password: "nouveau-mot-de-passe",
    });
  });

  it("un code refusé reste à l'étape du code, message générique, log sans e-mail ni code", async () => {
    fakeAuth.emailOtp.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_OTP", message: "Invalid OTP" },
    });

    const state = await resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: OTP, password: "nouveau-mot-de-passe" }),
    );

    expect(state).toEqual({ step: "code", email: EMAIL, error: "invalidCode" });
    expect(logged()).toContain("INVALID_OTP");
    expect(logged()).not.toContain(EMAIL);
    expect(logged()).not.toContain(OTP);
  });

  it("signale le service indisponible sur une erreur 500 à l'étape du code", async () => {
    fakeAuth.emailOtp.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });

    const state = await resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: OTP, password: "nouveau-mot-de-passe" }),
    );

    expect(state).toEqual({ step: "code", email: EMAIL, error: "unavailable" });
  });

  it("refuse un mot de passe de moins de 8 caractères sans appeler l'auth", async () => {
    const state = await resetPassword(
      { step: "code", email: EMAIL },
      form({ email: EMAIL, otp: OTP, password: "court" }),
    );

    expect(state).toEqual({
      step: "code",
      email: EMAIL,
      error: "weakPassword",
    });
    expect(fakeAuth.emailOtp.resetPassword).not.toHaveBeenCalled();
  });
});
