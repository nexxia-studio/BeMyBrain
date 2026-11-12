"use client";

// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// Barre latérale (ordinateur, DESIGN.md § 5) : verre, titre du côté, sections. Sous 1024 px, c'est la
// barre d'onglets qui navigue (repli géré par le layout).
// raccourci: catégories sans sous-catégories, donc sans dépliage — chevron et aria-expanded arrivent avec
// le premier module qui a des sous-sections.
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Side } from "@/modules/core/schemas";

import { NavLink } from "./NavLink";
import { isActivePath, NAV_ITEMS } from "./nav-items";

type SidebarProps = {
  side: Side;
  /** Bas de la barre (déconnexion), rendu par le serveur. */
  footer?: React.ReactNode;
  className?: string;
};

export function Sidebar({ side, footer, className }: SidebarProps) {
  const t = useTranslations("shell");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("navigation")}
      className={cn(
        "glass w-60 shrink-0 flex-col gap-1 self-start rounded-tile p-3.5",
        className,
      )}
    >
      <p className="px-3 pt-2 pb-1.5 text-eyebrow uppercase text-muted-foreground">
        {t(`sideTitle.${side}`)}
      </p>
      {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <NavLink
            key={href}
            href={href}
            active={active}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3.5 text-body font-semibold text-foreground hover:bg-accent hover:text-foreground",
              active && "bg-pill-active shadow-raised hover:bg-pill-active",
            )}
          >
            <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
            {t(labelKey)}
          </NavLink>
        );
      })}
      {footer ? (
        <div className="mt-2 border-t border-border pt-2">{footer}</div>
      ) : null}
    </nav>
  );
}
