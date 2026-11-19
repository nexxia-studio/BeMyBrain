import { z } from "zod";

import { defineAction } from "@/modules/actions/define";

import { listContexts } from "./queries";
import { setMemberLocale } from "./mutations";
import { localeSchema, sideSchema } from "./schemas";

// Actions du module core (ADR-009). Le workspace et l'utilisateur viennent du contexte (session), jamais
// des paramètres : `z.strictObject` refuse toute clé en trop.

export const listContextsAction = defineAction({
  name: "core.listContexts",
  description: "actions.core.listContexts",
  params: z.strictObject({
    side: sideSchema.describe(
      "Side of life to list the spaces of: private (personal life) or pro (work).",
    ),
  }),
  access: "read",
  channels: ["web", "assistant"],
  run: (ctx, { side }) => listContexts(ctx.workspaceId, { side }, ctx.tx),
});

export const setLocaleAction = defineAction({
  name: "core.setLocale",
  description: "actions.core.setLocale",
  params: z.strictObject({
    locale: localeSchema.describe(
      "Interface language to switch to: fr (French) or en (English).",
    ),
  }),
  access: "write",
  channels: ["web", "assistant"],
  run: (ctx, { locale }) =>
    setMemberLocale(ctx.workspaceId, ctx.userId, locale, ctx.tx),
});

export const coreActions = [listContextsAction, setLocaleAction] as const;
