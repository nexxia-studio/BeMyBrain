"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Barre d'onglets flottante (mobile et tablette < 1024 px, DESIGN.md § 5–6) : verre, au-dessus de la
// zone sûre basse, bouton d'ajout au centre. Les onglets se répartissent de part et d'autre du bouton.
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { QuickAddTrigger } from "@/components/quick-add/QuickAddTrigger";
import { cn } from "@/lib/utils";
import type { Side } from "@/modules/core/sides";

import { NavLink } from "./NavLink";
import { isActivePath, navItemsFor } from "./nav-items";

type TabBarProps = {
  /** Côté actif (lu par le layout) : Listes n'existe que côté Privé. */
  side: Side;
  className?: string;
};

export function TabBar({ side, className }: TabBarProps) {
  const t = useTranslations("shell");
  const tQuickAdd = useTranslations("quickAdd");
  const pathname = usePathname();

  const items = navItemsFor(side);
  const half = Math.ceil(items.length / 2);
  const groups = [items.slice(0, half), items.slice(half)];

  const [before, after] = groups.map((items, index) => (
    <div key={index} className="flex flex-1 items-center gap-0.5">
      {items.map(({ href, labelKey, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <NavLink
            key={href}
            href={href}
            active={active}
            className={cn(
              "flex min-h-13 flex-1 flex-col items-center justify-center gap-1 text-tab no-underline",
              active
                ? "text-link hover:text-link"
                : "text-muted-foreground hover:text-muted-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-5.5" strokeWidth={2} />
            {t(labelKey)}
          </NavLink>
        );
      })}
    </div>
  ));

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-tabbar-offset z-(--z-tabbar) pr-safe-right pl-safe-left",
        className,
      )}
    >
      <nav
        aria-label={t("navigation")}
        className="glass mx-4 flex items-center gap-0.5 rounded-bar px-2.5 py-2"
      >
        {before}
        {/* Ouvre l'ajout rapide, au pouce, au centre de la barre (spec todo-unifiee) ; la palette est dans
            l'en-tête. */}
        <QuickAddTrigger
          label={tQuickAdd("open")}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-fab"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.4} />
        </QuickAddTrigger>
        {after}
      </nav>
    </div>
  );
}
