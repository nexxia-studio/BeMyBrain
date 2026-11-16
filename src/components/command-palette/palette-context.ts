"use client";

import { createContext, useContext } from "react";

/** Ouvre la palette de commandes ; fourni par CommandPaletteProvider (coque de l'app). */
export const OpenPaletteContext = createContext<(() => void) | null>(null);

export function useOpenPalette(): () => void {
  const open = useContext(OpenPaletteContext);
  // Erreur de développeur (déclencheur hors de la coque), jamais affichée à l'utilisateur.
  if (!open) throw new Error("useOpenPalette hors de CommandPaletteProvider");
  return open;
}
