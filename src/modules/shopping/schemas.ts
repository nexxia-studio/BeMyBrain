import { z } from "zod";

import { AISLE_KEYS } from "./aisles";

// Paramètres des actions shopping.* (ADR-009). Aucun workspaceId ni userId : ils viennent du contexte.
// Zod reste côté serveur (gotcha CSP) : ce fichier n'est importé que par actions.ts. `.describe()` en anglais :
// il devient la description du champ dans le JSON Schema d'outil lu par un modèle.

/**
 * Borne large côté schéma (protège d'une saisie énorme) ; la règle exacte (80 caractères après nettoyage,
 * caractères refusés) est celle de cleanLabel, appliquée par les mutations.
 */
const LABEL_INPUT_MAX = 400;

const itemIdSchema = z.uuid().describe("Shopping item id (UUID).");

const labelSchema = z
  .string()
  .min(1)
  .max(LABEL_INPUT_MAX)
  .describe("Item label, at most 80 characters once cleaned (e.g. milk).");

const aisleSchema = z.enum(AISLE_KEYS).describe("Aisle key.");

export const noParams = z.strictObject({});
export const addItemParams = z.strictObject({ label: labelSchema });
export const itemIdParams = z.strictObject({ itemId: itemIdSchema });
export const renameItemParams = z.strictObject({
  itemId: itemIdSchema,
  label: labelSchema,
});
export const moveItemToAisleParams = z.strictObject({
  itemId: itemIdSchema,
  aisleKey: aisleSchema,
});
export const setAisleOrderParams = z.strictObject({
  order: z
    .array(aisleSchema)
    .length(AISLE_KEYS.length)
    .describe(
      `Every aisle key exactly once (${AISLE_KEYS.length} keys), in the wanted display order.`,
    ),
});
