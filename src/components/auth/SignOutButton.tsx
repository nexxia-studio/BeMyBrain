"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

/** Bouton d'envoi du formulaire de déconnexion, désactivé pendant l'appel. */
export function SignOutButton() {
  const t = useTranslations("auth");
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
    >
      {t("signOut")}
    </button>
  );
}
