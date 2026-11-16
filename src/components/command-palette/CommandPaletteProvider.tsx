"use client";

// Palette de commandes de la coque (ADR-009) : état d'ouverture, raccourci ⌘K / Ctrl+K (bascule), et
// fonction d'ouverture partagée avec les déclencheurs (recherche et ajout de l'en-tête, ajout mobile).
import { useCallback, useEffect, useState } from "react";

import { CommandPalette } from "./CommandPalette";
import { isPaletteShortcut } from "./commands";
import { OpenPaletteContext } from "./palette-context";

type CommandPaletteProviderProps = {
  children: React.ReactNode;
};

export function CommandPaletteProvider({
  children,
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
      <CommandPalette open={open} onOpenChange={setOpen} />
    </OpenPaletteContext>
  );
}
