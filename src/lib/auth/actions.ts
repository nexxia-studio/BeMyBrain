"use server";

import { redirect } from "next/navigation";

import { HOME_PATH, LOGIN_PATH } from "./routes";
import {
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
} from "./schemas";
import { getAuth } from "./server";

// Erreurs renvoyées à l'écran : des codes, traduits par le composant. Jamais le message de
// Neon Auth (il peut dire si un compte existe, ou porter l'adresse saisie).
export type SignInState = { error: "invalidCredentials" | "unavailable" } | null;

export type ResetState =
  | { step: "email"; error?: "invalidEmail" | "unavailable" }
  | {
      step: "code";
      email: string;
      error?: "invalidCode" | "weakPassword" | "unavailable";
    };

type AuthResultError = { code?: string } | null | undefined;

function isUnavailable(error: AuthResultError) {
  return typeof error?.code === "string" && error.code.startsWith("NETWORK_");
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: "invalidCredentials" };

  const { error } = await getAuth().signIn.email(parsed.data);
  if (error) {
    return { error: isUnavailable(error) ? "unavailable" : "invalidCredentials" };
  }
  redirect(HOME_PATH);
}

export async function signOut(): Promise<void> {
  await getAuth().signOut();
  redirect(LOGIN_PATH);
}

export async function requestPasswordReset(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const parsed = requestResetSchema.safeParse({
    email: field(formData, "email"),
  });
  if (!parsed.success) return { step: "email", error: "invalidEmail" };

  const { error } = await getAuth().emailOtp.sendVerificationOtp({
    email: parsed.data.email,
    type: "forget-password",
  });
  if (isUnavailable(error)) return { step: "email", error: "unavailable" };
  // Toute autre réponse mène à l'étape du code : l'écran ne dit pas si le compte existe.
  return { step: "code", email: parsed.data.email };
}

export async function resetPassword(
  previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = previous.step === "code" ? previous.email : "";
  const parsed = resetPasswordSchema.safeParse({
    email: field(formData, "email") || email,
    otp: field(formData, "otp"),
    password: field(formData, "password"),
  });
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return {
      step: "code",
      email,
      error: weak ? "weakPassword" : "invalidCode",
    };
  }

  const { error } = await getAuth().emailOtp.resetPassword(parsed.data);
  if (error) {
    return {
      step: "code",
      email: parsed.data.email,
      error: isUnavailable(error) ? "unavailable" : "invalidCode",
    };
  }
  redirect(`${LOGIN_PATH}?reset=done`);
}
