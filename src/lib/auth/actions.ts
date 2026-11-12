"use server";

import { cookies } from "next/headers";
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
// L'e-mail saisi revient dans l'état pour être réaffiché (React 19 vide le formulaire après l'action).
export type SignInState = {
  error: "invalidCredentials" | "unavailable";
  email: string;
} | null;

export type ResetState =
  | { step: "email"; email?: string; error?: "invalidEmail" | "unavailable" }
  | {
      step: "code";
      email: string;
      error?: "invalidCode" | "weakPassword" | "unavailable";
    };

type AuthError = { code?: unknown; status?: unknown } | null | undefined;

// Préfixe des cookies du SDK @neon/auth (session_token, local.session_data, session_challenge).
const AUTH_COOKIE_PREFIX = "__Secure-neon-auth";

/** Panne ou saturation de Neon Auth : transport, 5xx ou limite de tentatives (429). */
function isUnavailable(error: AuthError) {
  const status = typeof error?.status === "number" ? error.status : 0;
  return (
    status >= 500 ||
    status === 429 ||
    (typeof error?.code === "string" && error.code.startsWith("NETWORK_"))
  );
}

/**
 * Journal serveur d'un échec : statut HTTP et code d'erreur Neon seulement.
 * Jamais l'e-mail, le mot de passe, le code saisi ni le message de l'auth.
 */
function logFailure(action: string, error: AuthError) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : undefined;
  console.warn(`[auth] ${action} : échec`, { status, code });
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** E-mail saisi, réaffiché tel quel dans le formulaire (borné). */
function typedEmail(formData: FormData) {
  return field(formData, "email").trim().slice(0, 254);
}

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = typedEmail(formData);
  const parsed = signInSchema.safeParse({
    email,
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: "invalidCredentials", email };

  const { error } = await getAuth().signIn.email(parsed.data);
  if (error) {
    logFailure("signIn", error);
    return {
      error: isUnavailable(error) ? "unavailable" : "invalidCredentials",
      email,
    };
  }
  redirect(HOME_PATH);
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await getAuth().signOut();
    if (error) logFailure("signOut", error);
  } catch {
    logFailure("signOut", null);
  }
  // Quoi qu'il arrive côté Neon Auth, le navigateur perd sa session. Un cookie `__Secure-`
  // n'est accepté (donc effacé) que s'il est renvoyé avec Secure.
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (!name.startsWith(AUTH_COOKIE_PREFIX)) continue;
    store.set(name, "", {
      maxAge: 0,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
    });
  }
  redirect(LOGIN_PATH);
}

export async function requestPasswordReset(
  _previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = typedEmail(formData);
  const parsed = requestResetSchema.safeParse({ email });
  if (!parsed.success) return { step: "email", email, error: "invalidEmail" };

  const { error } = await getAuth().emailOtp.sendVerificationOtp({
    email: parsed.data.email,
    type: "forget-password",
  });
  if (error) {
    logFailure("requestPasswordReset", error);
    if (isUnavailable(error))
      return { step: "email", email, error: "unavailable" };
  }
  // Toute autre réponse mène à l'étape du code : l'écran ne dit pas si le compte existe.
  return { step: "code", email: parsed.data.email };
}

export async function resetPassword(
  previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email =
    typedEmail(formData) || (previous.step === "code" ? previous.email : "");
  const parsed = resetPasswordSchema.safeParse({
    email,
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
    logFailure("resetPassword", error);
    return {
      step: "code",
      email,
      error: isUnavailable(error) ? "unavailable" : "invalidCode",
    };
  }
  redirect(`${LOGIN_PATH}?reset=done`);
}
