// Curseurs nexxia-design (DESIGN.md § 1, tableau de bord) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Tuile « Aujourd'hui » (DESIGN.md § 5) : la seule tuile pleine de l'app. Date du jour selon la langue,
// salutation, puis ce qui compte aujourd'hui dans les espaces retenus ; vide tant qu'aucun module n'existe.
// Animée par GSAP seul (entrée du tableau de bord) : aucun survol Motion.
// raccourci: salutation sans prénom, la session ne porte pas le nom de l'utilisateur — à ajouter avec
// l'onboarding (BRAIN-31).
import { useFormatter, useNow, useTranslations } from "next-intl";

type TodayTileProps = {
  /** Espaces retenus du côté actif (noms saisis, jamais traduits). */
  spaces: string[];
  workspaceName: string;
};

export function TodayTile({ spaces, workspaceName }: TodayTileProps) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const now = useNow();

  return (
    <section
      data-signature="intro"
      data-testid="tile-today"
      className="flex min-w-0 grow-2 basis-100 flex-col justify-between gap-5.5 rounded-tile bg-primary p-today text-primary-foreground shadow-today lg:min-h-75"
    >
      <div className="flex flex-col gap-2.5">
        <p
          data-signature-item
          className="text-eyebrow text-on-primary-muted uppercase"
        >
          {format.dateTime(now, {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h2 data-signature-item className="font-heading text-display">
          {t("today.greeting")}
        </h2>
        <p
          data-signature-item
          className="max-w-105 text-lead text-on-primary-lead"
        >
          {spaces.length > 0
            ? t("today.intro", {
                spaces: format.list(spaces, { type: "conjunction" }),
              })
            : t("today.introNoSpace")}
        </p>
      </div>
      <p className="text-small text-on-primary-muted">
        {t.rich("workspace", {
          // Nom saisi par l'utilisateur : affiché tel quel, jamais traduit.
          name: () => (
            <span data-testid="workspace-name" className="font-semibold">
              {workspaceName}
            </span>
          ),
        })}
      </p>
    </section>
  );
}
