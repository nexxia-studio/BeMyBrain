"use client";

// Message d'échec d'une préférence d'affichage (bascule, filtre d'espace). La zone `role="status"` est
// toujours rendue (vide sinon) pour que les lecteurs d'écran annoncent le message à son arrivée. Bulle
// opaque (`popover`) sous le contrôle : jamais de verre sur du verre (DESIGN.md § 4).
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type PreferenceStatusProps = {
  failed: boolean;
  className?: string;
};

export function PreferenceStatus({ failed, className }: PreferenceStatusProps) {
  const t = useTranslations("shell");

  return (
    <p
      role="status"
      className={cn(
        "absolute top-full z-(--z-toast) mt-2 w-max max-w-64",
        className,
      )}
    >
      {failed ? (
        <span className="block rounded-lg bg-popover px-3 py-2 text-small font-medium text-destructive shadow-glass">
          {t("preferenceError")}
        </span>
      ) : null}
    </p>
  );
}
