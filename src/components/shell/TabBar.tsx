"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Barre d'onglets flottante (mobile et tablette < 1024 px, DESIGN.md § 5–6) : verre, au-dessus de la
// zone sûre basse, bouton d'ajout au centre. Les onglets se répartissent de part et d'autre du bouton.
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { NavLink } from "./NavLink";
import { isActivePath, NAV_ITEMS } from "./nav-items";

const half = Math.ceil(NAV_ITEMS.length / 2);
const GROUPS = [NAV_ITEMS.slice(0, half), NAV_ITEMS.slice(half)];

type TabBarProps = {
  className?: string;
};

export function TabBar({ className }: TabBarProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();

  const [before, after] = GROUPS.map((items, index) => (
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
        {/* raccourci: sans action jusqu'à la palette de commandes (tâche 20), donc désactivé — l'activer alors. */}
        <button
          type="button"
          disabled
          aria-label={t("quickAdd")}
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-fab disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.4} />
        </button>
        {after}
      </nav>
    </div>
  );
}
