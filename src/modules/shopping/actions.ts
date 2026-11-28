import { defineAction } from "@/modules/actions/define";

import {
  addItemParams,
  itemIdParams,
  moveItemToAisleParams,
  noParams,
  renameItemParams,
  setAisleOrderParams,
} from "./schemas";
import {
  addItem,
  checkItem,
  clearChecked,
  moveItemToAisle,
  removeItem,
  renameItem,
  setAisleOrder,
  uncheckItem,
} from "./mutations";
import { getShoppingList } from "./queries";

// Actions du module shopping (ADR-009). Le workspace et l'utilisateur viennent du contexte, jamais des
// paramètres (`z.strictObject`). Une action d'écriture = UNE mutation (ordre des verrous de mutations.ts).
// Canaux : toutes pour le web ; l'assistant voit la lecture et deux écritures seulement (liste blanche,
// spec « Registre d'actions ») : ajouter et cocher. Le reste (renommer, supprimer, vider, ranger) reste à
// l'écran.

const web = ["web"] as const;
const webAndAssistant = ["web", "assistant"] as const;

export const listItemsAction = defineAction({
  name: "shopping.listItems",
  description: "actions.shopping.listItems",
  params: noParams,
  access: "read",
  channels: webAndAssistant,
  run: (ctx) => getShoppingList(ctx.workspaceId, ctx.tx),
});

export const addItemAction = defineAction({
  name: "shopping.addItem",
  description: "actions.shopping.addItem",
  params: addItemParams,
  access: "write",
  channels: webAndAssistant,
  run: (ctx, { label }) => addItem(ctx.workspaceId, label, ctx.tx),
});

export const checkItemAction = defineAction({
  name: "shopping.checkItem",
  description: "actions.shopping.checkItem",
  params: itemIdParams,
  access: "write",
  channels: webAndAssistant,
  run: (ctx, { itemId }) => checkItem(ctx.workspaceId, itemId, ctx.tx),
});

export const uncheckItemAction = defineAction({
  name: "shopping.uncheckItem",
  description: "actions.shopping.uncheckItem",
  params: itemIdParams,
  access: "write",
  channels: web,
  run: (ctx, { itemId }) => uncheckItem(ctx.workspaceId, itemId, ctx.tx),
});

export const renameItemAction = defineAction({
  name: "shopping.renameItem",
  description: "actions.shopping.renameItem",
  params: renameItemParams,
  access: "write",
  channels: web,
  run: (ctx, { itemId, label }) =>
    renameItem(ctx.workspaceId, itemId, label, ctx.tx),
});

export const removeItemAction = defineAction({
  name: "shopping.removeItem",
  description: "actions.shopping.removeItem",
  params: itemIdParams,
  access: "write",
  channels: web,
  run: (ctx, { itemId }) => removeItem(ctx.workspaceId, itemId, ctx.tx),
});

export const clearCheckedAction = defineAction({
  name: "shopping.clearChecked",
  description: "actions.shopping.clearChecked",
  params: noParams,
  access: "write",
  channels: web,
  run: (ctx) => clearChecked(ctx.workspaceId, ctx.tx),
});

export const moveItemToAisleAction = defineAction({
  name: "shopping.moveItemToAisle",
  description: "actions.shopping.moveItemToAisle",
  params: moveItemToAisleParams,
  access: "write",
  channels: web,
  run: (ctx, { itemId, aisleKey }) =>
    moveItemToAisle(ctx.workspaceId, itemId, aisleKey, ctx.tx),
});

export const setAisleOrderAction = defineAction({
  name: "shopping.setAisleOrder",
  description: "actions.shopping.setAisleOrder",
  params: setAisleOrderParams,
  access: "write",
  channels: web,
  run: (ctx, { order }) => setAisleOrder(ctx.workspaceId, order, ctx.tx),
});

export const shoppingActions = [
  listItemsAction,
  addItemAction,
  checkItemAction,
  uncheckItemAction,
  renameItemAction,
  removeItemAction,
  clearCheckedAction,
  moveItemToAisleAction,
  setAisleOrderAction,
] as const;
