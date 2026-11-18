"use client";

import { unstable_rethrow } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { signIn, type SignInState } from "@/lib/auth/actions";

// raccourci: styles minimaux sur les tokens du scaffold — charte et primitives à la tâche 12.
const inputClass =
  "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring";
const buttonClass =
  "min-h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60";

// L'appel de l'action peut lever côté client : le pare-feu Vercel répond 403 (page HTML), Next lève
// « An unexpected response… » sans le code HTTP, comme pour une page 5xx. Un seul message pour les deux.
// Les erreurs de contrôle de Next (redirection après connexion) sont relancées.
async function submit(
  previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  try {
    return await signIn(previous, formData);
  } catch (error) {
    unstable_rethrow(error);
    const email = formData.get("email");
    return {
      error: "submitFailed",
      email: typeof email === "string" ? email.trim().slice(0, 254) : "",
    };
  }
}

type LoginFormProps = {
  /** Page d'origine (session expirée, QA-1), déjà filtrée par la page ; revalidée par l'action signIn. */
  next?: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<SignInState, FormData>(
    submit,
    null,
  );
  const errorId = "login-error";

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
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
