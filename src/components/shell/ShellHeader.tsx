// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// En-tête de la coque (DESIGN.md § 5) — mobile : nom + pilule + bouton rond de la palette, sur le fond nu
// (comme la référence ; le bouton est en verre, comme la pilule) ; ordinateur (≥ 1024 px) : verre, logo + nom,
// pilule au centre, recherche ⌘K et bouton d'ajout rond (ajout rapide).
import { Plus, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { PaletteTrigger } from "@/components/command-palette/PaletteTrigger";
import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import type { Side } from "@/modules/core/schemas";

import { BrandMark } from "./BrandMark";
import { SideSwitch } from "./SideSwitch";

type ShellHeaderProps = {
  side: Side;
};

export async function ShellHeader({ side }: ShellHeaderProps) {
  const [tApp, t, tQuickAdd] = await Promise.all([
    getTranslations("app"),
    getTranslations("shell"),
    getTranslations("quickAdd"),
  ]);

  return (
    // Hauteur sur ordinateur reprise par `--header-height` (globals.css) pour placer le panneau du détail
    // dessous : changer le padding, le bord ou la hauteur de la pilule Privé / Pro, c'est changer ce jeton.
    <header className="flex items-center justify-between gap-3 lg:glass lg:gap-3.5 lg:rounded-tile lg:px-4 lg:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden lg:flex">
          <BrandMark />
        </span>
        <span className="truncate font-heading text-brand">{tApp("name")}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 lg:contents">
        <SideSwitch side={side} />
        {/* Sous 1024 px, la palette s'ouvre ici ; le « + » de la barre d'onglets ouvre l'ajout rapide. */}
        <PaletteTrigger
          label={t("openPalette")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-foreground glass lg:hidden"
        >
          <Search aria-hidden="true" className="size-5" strokeWidth={2} />
        </PaletteTrigger>
      </div>
      <div className="hidden items-center gap-2.5 lg:flex">
        <PaletteTrigger className="flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-secondary px-4 text-body text-muted-foreground hover:text-foreground">
          <Search aria-hidden="true" className="size-4.5" strokeWidth={2} />
          {t("search")}
          <kbd className="rounded-sm bg-chip-neutral px-2 py-0.5 font-sans text-caption font-semibold text-chip-neutral-foreground">
            {t("searchShortcut")}
          </kbd>
        </PaletteTrigger>
        <QuickAddTrigger
          label={tQuickAdd("open")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Plus aria-hidden="true" className="size-5" strokeWidth={2.4} />
        </QuickAddTrigger>
      </div>
    </header>
  );
}
