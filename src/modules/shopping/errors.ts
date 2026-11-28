import { DomainError, INVALID_PARAMS_MESSAGE } from "@/lib/errors";

export type ShoppingErrorCode =
  /** Paramètre refusé : aucune requête n'est envoyée (libellé vide, workspace qui n'est pas un uuid). */
  | "invalid_params"
  /** Libellé de plus de 80 caractères après nettoyage. */
  | "label_too_long"
  /** La liste a déjà 300 articles. */
  | "list_full";

export class ShoppingError extends DomainError {
  declare readonly code: ShoppingErrorCode;
  constructor(code: ShoppingErrorCode) {
    super(code);
    // En dur : résiste à la minification (voir DomainError).
    this.name = "ShoppingError";
  }
}

/** Messages anglais lisibles par un modèle (canal assistant) ; l'UI traduit par `code`. */
export const SHOPPING_ERROR_MESSAGES: Record<ShoppingErrorCode, string> = {
  invalid_params: INVALID_PARAMS_MESSAGE,
  label_too_long: "The item label is limited to 80 characters.",
  list_full: "The shopping list is full (300 items maximum).",
};
