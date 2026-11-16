import { z } from "zod";

import { coreActions } from "@/modules/core/actions";

import { ActionError } from "./errors";
import type { ActionAccess, ActionContext, RegisteredAction } from "./types";

// Registre unique des actions (ADR-009). Chaque module qui veut être appelable y ajoute ses actions.

export type ActionRegistry = ReadonlyMap<string, RegisteredAction>;

/** Range des actions par nom ; deux actions du même nom → ActionError("duplicate_action"). */
export function createRegistry(
  actions: readonly RegisteredAction[],
): ActionRegistry {
  const byName = new Map<string, RegisteredAction>();
  for (const action of actions) {
    if (byName.has(action.name)) throw new ActionError("duplicate_action");
    byName.set(action.name, action);
  }
  return byName;
}

export const registry: ActionRegistry = createRegistry([...coreActions]);

/** Action trouvée et paramètres validés, prête à recevoir le contexte de la session. */
export type PreparedAction = {
  name: string;
  access: ActionAccess;
  execute: (ctx: ActionContext) => Promise<unknown>;
};

/**
 * Résout `name` et valide `params`, sans rien exécuter ni ouvrir de transaction. Nom inconnu (Map : pas de
 * clé héritée comme `__proto__`) → ActionError("unknown_action") ; paramètres refusés →
 * ActionError("invalid_params"). Les deux valeurs viennent du client : jamais recopiées dans l'erreur.
 */
export function prepareAction(
  actions: ActionRegistry,
  name: unknown,
  params: unknown,
): PreparedAction {
  const action = typeof name === "string" ? actions.get(name) : undefined;
  if (!action) throw new ActionError("unknown_action");
  const execute = action.bind(params);
  if (!execute) throw new ActionError("invalid_params");
  return { name: action.name, access: action.access, execute };
}

const contextSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.uuid(),
  tx: z.custom<ActionContext["tx"]>(
    (value) => typeof value === "object" && value !== null,
  ),
});

/**
 * Exécute une action préparée. Contexte incomplet → ActionError("missing_context"), `run` non appelé.
 * Exigé de toute action, lecture comprise (ADR-009 ne l'impose qu'aux écritures) : une lecture sans
 * workspace n'a pas de sens au socle.
 */
export async function invokeAction(
  prepared: PreparedAction,
  ctx: ActionContext,
): Promise<unknown> {
  if (!contextSchema.safeParse(ctx).success)
    throw new ActionError("missing_context");
  return prepared.execute(ctx);
}
