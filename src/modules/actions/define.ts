import type { ActionDefinition, RegisteredAction } from "./types";

/** Déclare une action (ADR-009) : la validation des paramètres précède toujours `run`. */
export function defineAction<P, R>(
  definition: ActionDefinition<P, R>,
): RegisteredAction {
  const { name, description, params, access, run } = definition;
  return {
    name,
    description,
    params,
    access,
    bind(raw) {
      const parsed = params.safeParse(raw);
      if (!parsed.success) return null;
      return (ctx) => run(ctx, parsed.data);
    },
  };
}
