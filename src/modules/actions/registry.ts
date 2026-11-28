import { z } from "zod";

import { coreActions } from "@/modules/core/actions";
import { shoppingActions } from "@/modules/shopping/actions";
import { tasksActions } from "@/modules/tasks/actions";

import en from "../../../messages/en.json";

import { ActionError } from "./errors";
import {
  actionOrigins,
  type ActionAccess,
  type ActionChannel,
  type ActionContext,
  type RegisteredAction,
  type ToolDefinition,
} from "./types";

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

export const registry: ActionRegistry = createRegistry([
  ...coreActions,
  ...tasksActions,
  ...shoppingActions,
]);

/** Action trouvée et paramètres validés, prête à recevoir le contexte de la session. */
export type PreparedAction = {
  name: string;
  access: ActionAccess;
  execute: (ctx: ActionContext) => Promise<unknown>;
};

/**
 * Résout `name` pour `channel` et valide `params`, sans rien exécuter ni ouvrir de transaction. Nom inconnu
 * (Map : pas de clé héritée comme `__proto__`) ou action qui ne déclare pas `channel` →
 * ActionError("unknown_action"), même erreur pour ne pas révéler l'action ; paramètres refusés →
 * ActionError("invalid_params"). Les deux valeurs viennent du client : jamais recopiées dans l'erreur.
 */
export function prepareAction(
  actions: ActionRegistry,
  name: unknown,
  params: unknown,
  channel: ActionChannel,
): PreparedAction {
  const action = typeof name === "string" ? actions.get(name) : undefined;
  if (!action || !action.channels.includes(channel))
    throw new ActionError("unknown_action");
  const execute = action.bind(params);
  if (!execute) throw new ActionError("invalid_params");
  return { name: action.name, access: action.access, execute };
}

const contextSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.uuid(),
  origin: z.enum(actionOrigins),
  tx: z.custom<ActionContext["tx"]>(
    (value) => typeof value === "object" && value !== null,
  ),
});

/**
 * Exécute une action préparée. Contexte incomplet (origine absente ou inconnue comprise) →
 * ActionError("missing_context"), `run` non appelé.
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

/**
 * Traduction anglaise d'une clé `description` (`messages/en.json`), texte à langue fixe pour un modèle.
 * Lecture directe du JSON plutôt que `createTranslator` : l'entrée de next-intl importe React, que le
 * registre ne doit pas charger (ADR-009). Même texte tant que la description n'utilise aucune syntaxe ICU
 * (accolades, apostrophe d'échappement) : vérifié contre `createTranslator` par registry.test.ts.
 * Clé absente → erreur de déclaration (la parité FR/EN est verrouillée par registry.test.ts).
 */
function describeInEnglish(key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" && Object.hasOwn(node, part)
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );
  if (typeof value !== "string")
    throw new Error(`Description d'action sans traduction anglaise : ${key}`);
  return value;
}

/**
 * Définitions d'outils des actions qui déclarent `channel`, pour un modèle (assistant IA, connecteur MCP) :
 * nom, description anglaise en clair et JSON Schema des paramètres d'entrée. Le schéma ne décrit que
 * `params` : workspace, utilisateur et origine viennent du contexte serveur, jamais du modèle. Un schéma
 * non représentable en JSON Schema lève une erreur. `actions` et `describe` ne servent qu'aux tests.
 */
export function toToolDefinitions(
  channel: ActionChannel,
  {
    actions = registry,
    describe = describeInEnglish,
  }: {
    actions?: ActionRegistry;
    describe?: (key: string) => string;
  } = {},
): ToolDefinition[] {
  return [...actions.values()]
    .filter((action) => action.channels.includes(channel))
    .map((action) => ({
      name: action.name,
      description: describe(action.description),
      inputSchema: z.toJSONSchema(action.params, { io: "input" }),
    }));
}
