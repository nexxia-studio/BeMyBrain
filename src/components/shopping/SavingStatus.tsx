"use client";

// Indicateur discret d'une écriture lente (> 1 s), texte secondaire sans animation (donc rien à couper en
// `prefers-reduced-motion`). La région `aria-live` est toujours montée : seul son texte apparaît, la structure
// autour ne change pas (le champ d'ajout n'est jamais remonté). Place réservée ou superposée par l'appelant
// (`className`). Un échec est annoncé ailleurs (« Pas enregistré, réessaie. »).
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useSlowPending } from "./use-slow-pending";

type SavingStatusProps = {
  pending: boolean;
  className?: string;
};

export function SavingStatus({ pending, className }: SavingStatusProps) {
  const t = useTranslations("shopping");
  const slow = useSlowPending(pending);
  return (
    <span
      aria-live="polite"
      data-testid="saving-status"
      className={cn("text-caption text-muted-foreground", className)}
    >
      {slow ? t("saving") : null}
    </span>
  );
}
