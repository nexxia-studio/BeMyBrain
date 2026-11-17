import type { z } from "zod";

import type { UserTx } from "@/db/client";

// Registre d'actions (ADR-009) : sans React ni Next, partagé par la palette aujourd'hui, l'assistant IA,
// WhatsApp et Slack demain.

export type ActionAccess = "read" | "write";

/**
 * Canal d'appel : `web` = palette et Server Actions de l'app, `assistant` = assistant IA. Union à étendre
 * (whatsapp, slack…) le jour où le canal existe, pas avant.
 */
export type ActionChannel = "web" | "assistant";

/**
 * Contexte d'exécution, construit côté serveur seulement : `workspaceId` de la session, `userId` = `sub` du
 * jeton vérifié par withUserDb, `tx` = transaction de ce jeton (RLS active). Jamais un paramètre d'action.
 */
export type ActionContext = {
  workspaceId: string;
  userId: string;
  tx: UserTx;
};

/** Déclaration d'une action, telle qu'un module l'écrit (src/modules/<module>/actions.ts). */
export type ActionDefinition<P, R> = {
  /** Stable, `<module>.<verbe>` (ex. `core.setLocale`) : c'est ce nom que les canaux appellent. */
  name: string;
  /** Clé de traduction (ADR-007), lisible par un agent comme par la palette. */
  description: string;
  /** Paramètres validés avant `run` ; `z.strictObject` : une clé en trop (userId, workspaceId…) est refusée. */
  params: z.ZodType<P>;
  access: ActionAccess;
  /** Canaux autorisés à appeler l'action ; un canal absent la rend inconnue pour lui. Au moins un. */
  channels: readonly ActionChannel[];
  /** N'appelle que les fonctions de src/modules/<module>/ (ADR-002, ADR-004). */
  run: (ctx: ActionContext, params: P) => Promise<R>;
};

/**
 * Action rangée au registre : mêmes champs déclaratifs, et `bind`, qui valide des paramètres reçus et
 * renvoie l'exécution liée à ces paramètres validés (ou null si refusés). `run` n'est jamais exposé seul :
 * aucune exécution sans validation.
 */
export type RegisteredAction = {
  name: string;
  description: string;
  params: z.ZodType<unknown>;
  access: ActionAccess;
  channels: readonly ActionChannel[];
  bind: (raw: unknown) => ((ctx: ActionContext) => Promise<unknown>) | null;
};
