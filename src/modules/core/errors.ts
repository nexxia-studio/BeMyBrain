import { DomainError, INVALID_PARAMS_MESSAGE } from "@/lib/errors";

export type CoreErrorCode =
  /** Paramètre refusé par zod (uuid, côté, locale) : aucune requête n'est envoyée. */
  | "invalid_params"
  /** Aucune ligne (workspaceId, userId) modifiable : autre membre, autre workspace ou appartenance absente. */
  | "member_not_found";

/**
 * Message anglais par code, lisible par un modèle (assistant, connecteur) : ce qui est refusé et quoi faire.
 * Phrases fixes : jamais la valeur reçue ni une donnée d'un autre workspace.
 */
export const CORE_ERROR_MESSAGES = {
  invalid_params: INVALID_PARAMS_MESSAGE,
  member_not_found:
    "The user is not a member of this workspace. Nothing was changed.",
} as const satisfies Record<CoreErrorCode, string>;

export class CoreError extends DomainError {
  declare readonly code: CoreErrorCode;
  constructor(code: CoreErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "CoreError";
  }
}
