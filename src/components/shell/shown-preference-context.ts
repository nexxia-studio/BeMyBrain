"use client";

import { createContext, useContext } from "react";

import type { Side } from "@/modules/core/sides";

/**
 * Valeurs affichées (optimistes) de la bascule Privé / Pro et du filtre d'espace, remontées à la coque
 * (ShellScopeProvider) pour que l'ajout rapide et la palette prennent ce qui est affiché, pas le dernier
 * rendu serveur. Appelées dans la transition de l'enregistrement : elles retombent avec elle.
 */
export type ShowPreference = {
  showSide: (side: Side) => void;
  showSelection: (side: Side, selected: string[]) => void;
};

// Hors de la coque (tests d'un contrôle seul) : rien à remonter.
const NOTHING: ShowPreference = { showSide: () => {}, showSelection: () => {} };

export const ShowPreferenceContext = createContext<ShowPreference>(NOTHING);

export function useShowPreference(): ShowPreference {
  return useContext(ShowPreferenceContext);
}
