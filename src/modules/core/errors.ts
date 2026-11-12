import { DomainError } from "@/lib/errors";

export type CoreErrorCode =
  /** Paramètre refusé par zod (uuid, côté, locale) : aucune requête n'est envoyée. */
  | "invalid_input"
  /** Aucune ligne (workspaceId, userId) modifiable : autre membre, autre workspace ou appartenance absente. */
  | "member_not_found";

export class CoreError extends DomainError {
  declare readonly code: CoreErrorCode;
  constructor(code: CoreErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "CoreError";
  }
}
