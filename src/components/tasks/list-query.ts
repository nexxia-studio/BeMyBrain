// Requête de `/tasks` gardée par les liens qui quittent la page puis y reviennent (ligne ou carte → détail,
// détail → liste ou tableau, sous-tâche, parente, corbeille) : l'interrupteur « Terminées » de la liste, et
// « Tout voir » des colonnes Terminée et Annulée du tableau.

/** Paramètre d'adresse de l'interrupteur « Terminées ». */
export const COMPLETED_PARAM = "completed";
/** Paramètres d'adresse de « Tout voir » : colonne Terminée, colonne Annulée du tableau. */
export const DONE_PARAM = "done";
export const CANCELED_PARAM = "canceled";
/** Valeur de « Tout voir ». */
export const SEE_ALL = "all";

type Search = Record<string, string | string[] | undefined>;

// Paramètres gardés et leur seule valeur admise, dans l'ordre d'écriture.
const KEPT = [
  [COMPLETED_PARAM, "1"],
  [DONE_PARAM, SEE_ALL],
  [CANCELED_PARAM, SEE_ALL],
] as const;

/** Requête gardée (`?completed=1`, `?done=all&canceled=all`…), chaîne vide sans rien à garder. */
export function listQuery(search: Search): string {
  const kept = KEPT.filter(([name, value]) => search[name] === value);
  return kept.length === 0
    ? ""
    : `?${kept.map(([name, value]) => `${name}=${value}`).join("&")}`;
}

/** Requête gardée, un paramètre posé (`value`) ou retiré (`null`). */
export function listQueryWith(
  search: Search,
  name: string,
  value: string | null,
): string {
  return listQuery({ ...search, [name]: value ?? undefined });
}
