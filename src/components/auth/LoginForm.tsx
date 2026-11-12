"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { signIn, type SignInState } from "@/lib/auth/actions";

// raccourci: styles minimaux sur les tokens du scaffold — charte et primitives à la tâche 12.
const inputClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring";
const buttonClass =
  "min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60";

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<SignInState, FormData>(
    signIn,
    null,
  );
  const errorId = "login-error";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium">
          {t("login.email")}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.email}
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-describedby={state?.error ? errorId : undefined}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium">
          {t("login.password")}
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state?.error ? errorId : undefined}
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
