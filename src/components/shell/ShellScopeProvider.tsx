"use client";

// Côté et espace courants de la coque, tels qu'affichés : la bascule Privé / Pro et le filtre d'espace sont
// optimistes (frontend.md, « États ») ; l'ajout rapide et la palette suivent la valeur affichée, sinon une
// tâche ajoutée pendant l'enregistrement partirait sur l'ancien côté. Les contrôles remontent leur valeur
// affichée (`useShowPreference`) dans la transition de leur enregistrement ; `useOptimistic` la garde jusqu'à
// la fin de cette transition, puis retombe sur le rendu serveur (succès : la même ; échec : l'ancienne).
// Le layout fournit les espaces et le filtre des deux côtés : une bascule n'attend aucune lecture.
import { useMemo, useOptimistic } from "react";

import { CommandPaletteProvider } from "@/components/command-palette/CommandPaletteProvider";
import { QuickAddProvider } from "@/components/quick-add/QuickAddProvider";
import { currentScope, type ShellScope } from "@/lib/current-scope";
import type { Side } from "@/modules/core/sides";

import {
  type ShowPreference,
  ShowPreferenceContext,
} from "./shown-preference-context";

type ShellScopeProviderProps = {
  /** Lu par le layout (cookies et espaces du workspace). */
  shell: ShellScope;
  children: React.ReactNode;
};

export function ShellScopeProvider({
  shell,
  children,
}: ShellScopeProviderProps) {
  const [side, showSide] = useOptimistic(shell.side);
  const [sides, showSelection] = useOptimistic(
    shell.sides,
    (current, shown: { side: Side; selected: string[] }) => ({
      ...current,
      [shown.side]: { ...current[shown.side], selected: shown.selected },
    }),
  );
  const show = useMemo<ShowPreference>(
    () => ({
      showSide,
      showSelection: (shownSide, selected) =>
        showSelection({ side: shownSide, selected }),
    }),
    [showSide, showSelection],
  );
  const scope = currentScope(side, sides[side]);

  return (
    <ShowPreferenceContext value={show}>
      <QuickAddProvider scope={scope}>
        <CommandPaletteProvider scope={scope}>
          {children}
        </CommandPaletteProvider>
      </QuickAddProvider>
    </ShowPreferenceContext>
  );
}
