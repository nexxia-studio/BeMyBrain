"use client";

import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";

type SignOutButtonProps = {
  /** Remplace la forme discrète par défaut (bas de la barre latérale). */
  className?: string;
};

const QUIET =
  "min-h-11 rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60";

/** Bouton d'envoi du formulaire de déconnexion, désactivé pendant l'appel. */
export function SignOutButton({ className = QUIET }: SignOutButtonProps) {
  const t = useTranslations("auth");
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {t("signOut")}
    </button>
  );
}
