// Côté et espace courants de la coque, sans dépendance serveur : calculés par le layout (rendu serveur) et
// recalculés côté client sur les valeurs affichées (optimistes) de la bascule et du filtre (ShellScopeProvider).
import type { ContextOption } from "@/modules/core/context-colors";
import type { Side } from "@/modules/core/sides";

export type CurrentScope = {
  /** Côté actif (bascule Privé / Pro). */
  side: Side;
  /** Espaces du côté actif. Saisis par l'utilisateur : affichés tels quels, jamais traduits. */
  contexts: ContextOption[];
  /** Espace filtré quand le filtre n'en retient qu'un parmi plusieurs ; sinon aucun (tous affichés). */
  contextId: string | null;
};

/** Espaces d'un côté et sélection de son filtre (tous = aucun filtre). */
export type SideSelection = { contexts: ContextOption[]; selected: string[] };

/** Côté actif et, pour chaque côté, ses espaces et son filtre : de quoi suivre une bascule sans aller-retour. */
export type ShellScope = { side: Side; sides: Record<Side, SideSelection> };

export function currentScope(
  side: Side,
  { contexts, selected }: SideSelection,
): CurrentScope {
  const filtered = contexts.length > 1 && selected.length === 1;
  return { side, contexts, contextId: filtered ? selected[0] : null };
}
