// Requête de la liste `/tasks` gardée par les liens qui la quittent puis y reviennent (ligne → détail, détail →
// liste, sous-tâche, parente, corbeille) : aujourd'hui, l'interrupteur « Terminées » seulement.

/** Paramètre d'adresse de l'interrupteur « Terminées ». */
export const COMPLETED_PARAM = "completed";

/** `?completed=1` quand les terminées sont affichées, sinon chaîne vide. */
export function listQuery(
  search: Record<string, string | string[] | undefined>,
): string {
  return search[COMPLETED_PARAM] === "1" ? `?${COMPLETED_PARAM}=1` : "";
}
