import { DomainError } from "@/lib/errors";

export type ActionErrorCode =
  /** Aucune action de ce nom au registre : rien n'est exécuté. */
  | "unknown_action"
  /** Paramètres refusés par le schéma de l'action : rien n'est exécuté. */
  | "invalid_params"
  /** Contexte incomplet (workspaceId, userId ou transaction absents) : rien n'est exécuté. */
  | "missing_context"
  /** Deux actions déclarent le même nom (erreur de déclaration, levée au chargement du registre). */
  | "duplicate_action";

export class ActionError extends DomainError {
  declare readonly code: ActionErrorCode;
  constructor(code: ActionErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "ActionError";
  }
}
