"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import {
  requestPasswordReset,
  resetPassword,
  type ResetState,
} from "@/lib/auth/actions";

// raccourci: styles minimaux sur les tokens du scaffold — charte et primitives à la tâche 12.
const inputClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring read-only:text-muted-foreground";
const buttonClass =
  "min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60";
const secondaryButtonClass =
  "min-h-11 w-full rounded-lg border border-input px-4 text-base font-medium disabled:opacity-60";

// Un seul état pour tout le parcours : le bouton envoyé (`intent`) choisit l'action serveur.
// « Renvoyer un code » repasse par requestPasswordReset et efface l'erreur affichée.
async function dispatch(
  previous: ResetState,
  formData: FormData,
): Promise<ResetState> {
  return formData.get("intent") === "reset"
    ? resetPassword(previous, formData)
    : requestPasswordReset(previous, formData);
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<ResetState, FormData>(
    dispatch,
    { step: "email" },
  );

  if (state.step === "email") {
    const errorId = "reset-email-error";
    return (
      <form action={action} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t("reset.intro")}</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-email" className="text-sm font-medium">
            {t("reset.email")}
          </label>
          <input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={state.email}
            aria-describedby={state.error ? errorId : undefined}
            className={inputClass}
          />
        </div>
        {state.error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </p>
        )}
        <button
          type="submit"
          name="intent"
          value="request"
          disabled={pending}
          className={buttonClass}
        >
          {pending ? t("reset.sending") : t("reset.sendCode")}
        </button>
      </form>
    );
  }

  const errorId = "reset-code-error";
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <p role="status" className="text-sm text-muted-foreground">
          {t("reset.codeSent")}
        </p>
        {/* Visible en lecture seule : identifiant reconnu par les gestionnaires de mots de passe. */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-username" className="text-sm font-medium">
            {t("reset.email")}
          </label>
          <input
            id="reset-username"
            name="email"
            type="email"
            autoComplete="username"
            readOnly
            value={state.email}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-code" className="text-sm font-medium">
            {t("reset.code")}
          </label>
          <input
            id="reset-code"
            name="otp"
            type="text"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            required
            aria-describedby={state.error ? errorId : undefined}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password" className="text-sm font-medium">
            {t("reset.newPassword")}
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            aria-describedby={
              state.error
                ? `reset-password-hint ${errorId}`
                : "reset-password-hint"
            }
            className={inputClass}
          />
          <p id="reset-password-hint" className="text-sm text-muted-foreground">
            {t("reset.passwordHint")}
          </p>
        </div>
        {state.error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </p>
        )}
        <button
          type="submit"
          name="intent"
          value="reset"
          disabled={pending}
          className={buttonClass}
        >
          {pending ? t("reset.submitting") : t("reset.submit")}
        </button>
      </form>
      {/* Formulaire frère : renvoyer un code n'exige ni code ni mot de passe. */}
      <form action={action}>
        <input type="hidden" name="email" value={state.email} />
        <button
          type="submit"
          name="intent"
          value="request"
          disabled={pending}
          className={secondaryButtonClass}
        >
          {t("reset.resendCode")}
        </button>
      </form>
    </div>
  );
}
