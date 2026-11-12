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
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring";
const buttonClass =
  "min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [requested, request, requesting] = useActionState<
    ResetState,
    FormData
  >(requestPasswordReset, { step: "email" });
  const [reset, submitReset, resetting] = useActionState<ResetState, FormData>(
    resetPassword,
    { step: "code", email: "" },
  );

  if (requested.step === "email") {
    const errorId = "reset-email-error";
    return (
      <form action={request} className="flex flex-col gap-4">
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
            aria-describedby={requested.error ? errorId : undefined}
            className={inputClass}
          />
        </div>
        {requested.error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t(`errors.${requested.error}`)}
          </p>
        )}
        <button type="submit" disabled={requesting} className={buttonClass}>
          {requesting ? t("reset.sending") : t("reset.sendCode")}
        </button>
      </form>
    );
  }

  const error = reset.error;
  const errorId = "reset-code-error";
  return (
    <form action={submitReset} className="flex flex-col gap-4">
      <p role="status" className="text-sm text-muted-foreground">
        {t("reset.codeSent")}
      </p>
      {/* Identifiant pour les gestionnaires de mots de passe, et e-mail relu par l'action. */}
      <input
        type="hidden"
        name="email"
        autoComplete="username"
        value={requested.email}
      />
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
          aria-describedby={error ? errorId : undefined}
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
            error ? `reset-password-hint ${errorId}` : "reset-password-hint"
          }
          className={inputClass}
        />
        <p id="reset-password-hint" className="text-sm text-muted-foreground">
          {t("reset.passwordHint")}
        </p>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      <button type="submit" disabled={resetting} className={buttonClass}>
        {resetting ? t("reset.submitting") : t("reset.submit")}
      </button>
    </form>
  );
}
