import "server-only";

import { cache } from "react";

import {
  currentScope,
  type CurrentScope,
  type ShellScope,
  type SideSelection,
} from "@/lib/current-scope";
import { readContextSelection, readSide } from "@/lib/preferences";
import { requireSession, requireSessionToken } from "@/lib/session";
import { loadContextsBySide } from "@/modules/core/contexts";
import type { ContextOption } from "@/modules/core/context-colors";
import type { Side } from "@/modules/core/schemas";

export type { CurrentScope, ShellScope } from "@/lib/current-scope";

export type ContextFilterData = {
  /** Côté dont les espaces sont filtrés (le côté actif). */
  side: Side;
  /** Saisis par l'utilisateur : affichés tels quels, jamais traduits ; avec la couleur de leur pastille. */
  contexts: ContextOption[];
  /** Espaces retenus, revalidés contre ceux du workspace ; tous = aucun filtre. */
  selected: string[];
};

export type SideSpaces = ContextFilterData;

/**
 * Côté actif et, pour chacun des deux côtés, ses espaces et la sélection de son filtre (une seule lecture, une
 * transaction). Mémoïsé par requête (`cache` de React) : la coque, la barre latérale, l'en-tête de page et le
 * tableau de bord partagent cette lecture. Les deux côtés : l'ajout rapide et la palette suivent une bascule
 * optimiste sans attendre le rendu serveur (ShellScopeProvider).
 */
export const loadShellScope = cache(async (): Promise<ShellScope> => {
  const session = await requireSession();
  const [token, side] = await Promise.all([requireSessionToken(), readSide()]);
  const bySide = await loadContextsBySide(token, session.workspaceId);
  const selection = async (of: Side): Promise<SideSelection> => {
    const contexts = bySide[of].map(({ id, name, color }) => ({
      id,
      name,
      color,
    }));
    return {
      contexts,
      selected: await readContextSelection(
        of,
        contexts.map((context) => context.id),
      ),
    };
  };
  const [privateSide, proSide] = await Promise.all([
    selection("private"),
    selection("pro"),
  ]);
  return { side, sides: { private: privateSide, pro: proSide } };
});

/** Espaces du côté actif (Privé ou Pro) et sélection du filtre, quel que soit leur nombre. */
export const loadSideSpaces = cache(async (): Promise<SideSpaces> => {
  const { side, sides } = await loadShellScope();
  return { side, ...sides[side] };
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

/**
 * Côté et espace courants (spec todo-unifiee : l'ajout rapide « prend le filtre courant »). Même lecture
 * mémoïsée que le filtre d'espace.
 */
export const loadCurrentScope = cache(async (): Promise<CurrentScope> => {
  const { side, ...selection } = await loadSideSpaces();
  return currentScope(side, selection);
});
