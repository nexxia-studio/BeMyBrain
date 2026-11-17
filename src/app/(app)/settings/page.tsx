// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Réglages (BRAIN-7, ADR-007) : titre, puis une tuile en verre par groupe de réglages. Langue de
// l'interface ; Compte (déconnexion) sous 1024 px seulement, la barre latérale la porte au-dessus.
// Repli : une colonne sous 1024 px, deux colonnes au-dessus (la tuile Compte y est masquée).
// Pas de pastille de filtre d'espace : rien ici ne dépend des espaces.
import { getLocale, getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { LocalePicker } from "@/components/settings/LocalePicker";
import { PageHeader } from "@/components/shell/PageHeader";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { signOut } from "@/lib/auth/actions";
import { requireSession } from "@/lib/session";

const TILE = "glass flex min-w-0 flex-col gap-4 rounded-tile p-tile";

export default async function SettingsPage() {
  const [, rendered, t] = await Promise.all([
    requireSession(),
    getLocale(),
    getTranslations("settings"),
  ]);
  // Langue réellement rendue (cookie NEXT_LOCALE, recopié de l'appartenance à la connexion).
  const locale = isLocale(rendered) ? rendered : defaultLocale;

  return (
    <main className="flex flex-1 flex-col gap-grid">
      <PageHeader title={t("title")} contextFilter={false} />
      <div className="grid items-start gap-grid lg:grid-cols-2">
        <section aria-labelledby="settings-language" className={TILE}>
          <div className="flex flex-col gap-1.5">
            <h2
              id="settings-language"
              className="font-heading text-title text-foreground"
            >
              {t("language.title")}
            </h2>
            <p className="text-small text-muted-foreground">
              {t("language.description")}
            </p>
          </div>
          <LocalePicker locale={locale} />
        </section>
        <section
          aria-labelledby="settings-account"
          className={`${TILE} lg:hidden`}
        >
          <h2
            id="settings-account"
            className="font-heading text-title text-foreground"
          >
            {t("account.title")}
          </h2>
          <form action={signOut}>
            <SignOutButton className="min-h-11 rounded-full border border-border bg-secondary px-5 text-body font-semibold text-secondary-foreground disabled:cursor-not-allowed disabled:opacity-60" />
          </form>
        </section>
      </div>
    </main>
  );
}
