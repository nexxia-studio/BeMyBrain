// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// En-tête d'une page de (app) : titre (h1) et, sous 1024 px, la pastille du filtre d'espace à côté
// (DESIGN.md § 5). À partir de 1024 px, le filtre vit dans la barre latérale : la pastille est masquée.
// Les données du filtre viennent de loadContextFilter, mémoïsé par requête et partagé avec le layout.
import { loadContextFilter } from "@/lib/context-filter";
import { cn } from "@/lib/utils";

import { ContextFilterMenu } from "./ContextFilterMenu";

type PageHeaderProps = {
  /** Titre traduit par la page. */
  title: string;
  /** Faux sur une page dont le contenu ne dépend pas des espaces (réglages) : pas de pastille. */
  contextFilter?: boolean;
  /**
   * Vrai dans un `loading.tsx` : la pastille garde sa place exacte (le titre ne bouge pas à l'arrivée du
   * contenu) mais reste invisible, inerte et masquée aux lecteurs d'écran ; le contenu qui la remplace
   * démonterait un menu ouvert pendant l'attente.
   */
  filterInert?: boolean;
  /** Contrôles propres à la page (interrupteur « Terminées » de la to-do), après le filtre, à toutes les largeurs. */
  actions?: React.ReactNode;
};

export async function PageHeader({
  title,
  contextFilter = true,
  filterInert = false,
  actions,
}: PageHeaderProps) {
  const filter = contextFilter ? await loadContextFilter() : null;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="min-w-0 font-heading text-page-title">{title}</h1>
      {filter ? (
        <div
          aria-hidden={filterInert || undefined}
          inert={filterInert}
          className={cn("min-w-0 lg:hidden", filterInert && "invisible")}
        >
          <ContextFilterMenu
            key={filter.side}
            side={filter.side}
            contexts={filter.contexts}
            selected={filter.selected}
          />
        </div>
      ) : null}
      {actions}
    </header>
  );
}
