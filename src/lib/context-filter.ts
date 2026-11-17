import "server-only";

import { cache } from "react";

import { readContextSelection, readSide } from "@/lib/preferences";
import { requireSession, requireSessionToken } from "@/lib/session";
import { loadContexts } from "@/modules/core/contexts";
import type { Side } from "@/modules/core/schemas";

export type ContextFilterData = {
  /** Côté dont les espaces sont filtrés (le côté actif). */
  side: Side;
  /** Saisis par l'utilisateur : affichés tels quels, jamais traduits. */
  contexts: { id: string; name: string }[];
  /** Espaces retenus, revalidés contre ceux du workspace ; tous = aucun filtre. */
  selected: string[];
};

export type SideSpaces = ContextFilterData;

/**
 * Espaces du côté actif (Privé ou Pro) et sélection du filtre, quel que soit leur nombre. Mémoïsé par
 * requête (`cache` de React) : la barre latérale, l'en-tête de page et le tableau de bord partagent une
 * seule lecture.
 */
export const loadSideSpaces = cache(async (): Promise<SideSpaces> => {
  const session = await requireSession();
  const [token, side] = await Promise.all([requireSessionToken(), readSide()]);
  const contexts = await loadContexts(token, session.workspaceId, side);
  const ids = contexts.map((context) => context.id);
  return {
    side,
    contexts: contexts.map(({ id, name }) => ({ id, name })),
    selected: await readContextSelection(side, ids),
  };
});

/**
 * Filtre d'espace du côté actif (Privé ou Pro, BRAIN-30) : seulement s'il y a un choix à faire (au moins
 * deux espaces). Lecture partagée avec loadSideSpaces.
 */
export const loadContextFilter = cache(
  async (): Promise<ContextFilterData | null> => {
    const spaces = await loadSideSpaces();
    return spaces.contexts.length < 2 ? null : spaces;
  },
);
