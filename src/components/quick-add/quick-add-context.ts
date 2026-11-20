"use client";

import { createContext, useContext } from "react";

/** Ouvre l'ajout rapide ; fourni par QuickAddProvider (coque de l'app). */
export const OpenQuickAddContext = createContext<(() => void) | null>(null);

export function useOpenQuickAdd(): () => void {
  const open = useContext(OpenQuickAddContext);
  // Erreur de développeur (déclencheur hors de la coque), jamais affichée à l'utilisateur.
  if (!open) throw new Error("useOpenQuickAdd hors de QuickAddProvider");
  return open;
}
