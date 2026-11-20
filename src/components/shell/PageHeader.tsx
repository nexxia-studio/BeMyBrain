// Curseurs nexxia-design (DESIGN.md § 1, coque) : VARIANCE 4 · MOTION 5 · DENSITY 5.
// En-tête d'une page de (app) : titre (h1) et, sous 1024 px, la pastille du filtre d'espace à côté
// (DESIGN.md § 5). À partir de 1024 px, le filtre vit dans la barre latérale : la pastille est masquée.
// Les données du filtre viennent de loadContextFilter, mémoïsé par requête et partagé avec le layout.
import { loadContextFilter } from "@/lib/context-filter";

import { ContextFilterMenu } from "./ContextFilterMenu";

type PageHeaderProps = {
  /** Titre traduit par la page. */
  title: string;
  /** Faux sur une page dont le contenu ne dépend pas des espaces (réglages) : pas de pastille. */
  contextFilter?: boolean;
  /** Contrôles propres à la page (interrupteur « Terminées » de la to-do), après le filtre, à toutes les largeurs. */
  actions?: React.ReactNode;
};

export async function PageHeader({
  title,
  contextFilter = true,
  actions,
}: PageHeaderProps) {
  const filter = contextFilter ? await loadContextFilter() : null;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="min-w-0 font-heading text-page-title">{title}</h1>
      {filter ? (
        <div className="min-w-0 lg:hidden">
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
