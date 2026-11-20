"use client";

// Palette de commandes de la coque (ADR-009) : état d'ouverture, raccourci ⌘K / Ctrl+K (bascule), et
// fonction d'ouverture partagée avec les déclencheurs de recherche de l'en-tête (champ sur ordinateur, loupe
// sous 1024 px). Le bouton d'ajout de l'en-tête et le « + » mobile ouvrent l'ajout rapide, pas la palette.
// Placée sous QuickAddProvider : la commande « Nouvelle tâche » ouvre l'ajout rapide.
import { useCallback, useEffect, useState } from "react";

import { CommandPalette } from "./CommandPalette";
import { isPaletteShortcut, type PaletteScope } from "./commands";
import { OpenPaletteContext } from "./palette-context";

type CommandPaletteProviderProps = {
  children: React.ReactNode;
  /** Côté et espace courants (lus par le layout) : la tâche ajoutée depuis la palette les prend. */
  scope: PaletteScope;
};

export function CommandPaletteProvider({
  children,
  scope,
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenPaletteContext value={openPalette}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} scope={scope} />
    </OpenPaletteContext>
  );
}
