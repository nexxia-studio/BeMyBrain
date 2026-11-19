import { DomainError, INVALID_PARAMS_MESSAGE } from "@/lib/errors";

export type ActionErrorCode =
  /** Aucune action de ce nom au registre : rien n'est exécuté. */
  | "unknown_action"
  /** Paramètres refusés par le schéma de l'action : rien n'est exécuté. */
  | "invalid_params"
  /** Contexte incomplet (workspaceId, userId, origine ou transaction absents ou invalides) : rien n'est exécuté. */
  | "missing_context"
  /** Deux actions déclarent le même nom (erreur de déclaration, levée au chargement du registre). */
  | "duplicate_action";

/**
 * Message anglais par code, lisible par un modèle (assistant, connecteur) : ce qui est refusé et quoi faire.
 * Phrases fixes : jamais le nom d'action ni les paramètres reçus (ils viennent de l'appelant).
 */
export const ACTION_ERROR_MESSAGES = {
  unknown_action:
    "No action has this name on this channel. Use one of the listed tool names exactly.",
  invalid_params: INVALID_PARAMS_MESSAGE,
  missing_context:
    "The request has no valid session context. Nothing was done; the user needs to sign in again.",
  duplicate_action:
    "Two actions share the same name. This is a declaration error in the app; nothing was done.",
} as const satisfies Record<ActionErrorCode, string>;

export class ActionError extends DomainError {
  declare readonly code: ActionErrorCode;
  constructor(code: ActionErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "ActionError";
  }
}
