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

/**
 * Filtre d'espace du côté actif (Privé ou Pro, BRAIN-30) : seulement s'il y a un choix à faire (au moins
 * deux espaces). Mémoïsé par requête (`cache` de React) : la barre latérale (layout) et l'en-tête de
 * page le partagent sans seconde lecture.
 */
export const loadContextFilter = cache(
  async (): Promise<ContextFilterData | null> => {
    const session = await requireSession();
    const [token, side] = await Promise.all([
      requireSessionToken(),
      readSide(),
    ]);
    const contexts = await loadContexts(token, session.workspaceId, side);
    if (contexts.length < 2) return null;
    return {
      side,
      contexts: contexts.map(({ id, name }) => ({ id, name })),
      selected: await readContextSelection(
        side,
        contexts.map((context) => context.id),
      ),
    };
  },
);
