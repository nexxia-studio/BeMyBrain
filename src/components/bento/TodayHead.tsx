// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// En-tête de la tuile pleine « Aujourd'hui » (DESIGN.md § 5) : date du jour selon la langue, salutation, puis
// l'introduction si la tuile en a une. Rien de dû, c'est tout l'état vide compact de la tuile : la vraie tuile
// (TodayTile) et le givre de chargement (`dashboard/loading.tsx`, cale invisible) le rendent tous deux, dans le
// même corps (`TODAY_TILE_BODY_CLASSES`) : source unique de sa hauteur.
import { useFormatter, useNow, useTranslations } from "next-intl";

type TodayHeadProps = {
  /** Phrase d'introduction (rien de dû, côté sans espace) ; null quand la tuile a des tâches. */
  intro: string | null;
};

export function TodayHead({ intro }: TodayHeadProps) {
  const t = useTranslations("dashboard.today");
  const format = useFormatter();
  const now = useNow();

  return (
    <div className="flex flex-col gap-2.5">
      <p
        data-signature-item
        data-testid="today-date"
        className="text-eyebrow text-on-primary-muted uppercase"
      >
        {format.dateTime(now, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <h2 data-signature-item className="font-heading text-display">
        {t("greeting")}
      </h2>
      {intro !== null && (
        <p
          data-signature-item
          className="max-w-105 text-lead text-on-primary-lead"
        >
          {intro}
        </p>
      )}
    </div>
  );
}
