"use client";

// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Contrôles de l'essai iPhone (BRAIN-33). « Revoir le reflet » efface les marqueurs de session des moments
// (SIGNATURE_KEYS, et rien d'autre) puis ouvre /dashboard par un chargement complet : BentoGrid fige sa
// décision au premier rendu client du document, une navigation côté client ne rejouerait rien.
// Liens : vraies pages après 3 s, pour voir le givre. Une colonne à toutes les largeurs.
// raccourci: page temporaire, retirée à la dernière tâche du plan effets-de-verre (demo-access.ts).
import Link from "next/link";
import { useTranslations } from "next-intl";

import { HOME_PATH } from "@/lib/auth/routes";
import { SIGNATURE_KEYS } from "@/components/signature/signature-keys";

const SLOW_LINKS = [
  ["/demo/effets-de-verre/lent/tableau-de-bord", "slowDashboard"],
  ["/demo/effets-de-verre/lent/taches", "slowTasks"],
] as const;

function replaySheen() {
  for (const key of SIGNATURE_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Stockage indisponible : les moments comptent déjà comme joués, rien à effacer.
    }
  }
  window.location.assign(HOME_PATH);
}

export function GlassDemo() {
  const t = useTranslations("glassDemo");

  return (
    <div className="flex max-w-prose flex-col items-start gap-4">
      <p className="text-small text-muted-foreground">{t("intro")}</p>
      <button
        type="button"
        onClick={replaySheen}
        className="min-h-11 rounded-full bg-primary px-4 text-small font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {t("replaySheen")}
      </button>
      {SLOW_LINKS.map(([href, key]) => (
        <Link
          key={key}
          href={href}
          className="flex min-h-11 items-center text-small font-semibold text-link no-underline hover:text-link-hover"
        >
          {t(key)}
        </Link>
      ))}
    </div>
  );
}
