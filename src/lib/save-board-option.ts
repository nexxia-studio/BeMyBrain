import { type BoardOption } from "./tasks-view";
import { writeBoardOptionCookie } from "./board-option-cookie";
import { setBoardOption } from "./preferences-actions";

/**
 * Enregistre une option du tableau : cookie posé au clic (un rechargement avant la fin de l'action relit le bon
 * état), puis action serveur. Échec : l'ancienne valeur est réécrite dans le cookie, pour que le navigateur et
 * l'interface (qui revient à l'état enregistré) n'aient qu'une seule vérité ; l'erreur est relancée.
 */
export async function saveBoardOption(
  option: BoardOption,
  next: boolean,
  previous: boolean,
): Promise<void> {
  writeBoardOptionCookie(option, next);
  try {
    await setBoardOption(option, next);
  } catch (error) {
    writeBoardOptionCookie(option, previous);
    throw error;
  }
}
