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
 * Origine d'un appel, enregistrée sur ce qu'il écrit (`tasks.origin`) : `app` = Server Actions des écrans,
 * `palette` = palette de commandes, `assistant` = assistant IA (déclaré, aucune route encore). Posée par le
 * point d'entrée serveur, jamais lue dans les paramètres. Sous-ensemble du CHECK `tasks_origin_check` ;
 * whatsapp et slack s'ajoutent le jour où le canal existe.
 * Elle dit par quel point d'entrée l'appel est arrivé ; sur le web, ce point d'entrée est choisi par le
 * client (il peut appeler la Server Action de la palette ou celle des écrans). Information de traçabilité
 * seulement : ne jamais s'en servir pour une décision de sécurité (droit, filtrage, limite).
 */
export const actionOrigins = ["app", "palette", "assistant"] as const;
export type ActionOrigin = (typeof actionOrigins)[number];

/** Origines du canal `web`, les seules que `runActionWithToken` accepte. */
export type WebActionOrigin = Extract<ActionOrigin, "app" | "palette">;

/**
 * Contexte d'exécution, construit côté serveur seulement : `workspaceId` de la session, `userId` = `sub` du
 * jeton vérifié par withUserDb, `origin` posée par le point d'entrée serveur, `tx` = transaction de ce
 * jeton (RLS active). Jamais un paramètre d'action.
 */
export type ActionContext = {
  workspaceId: string;
  userId: string;
  origin: ActionOrigin;
  tx: UserTx;
};

/** Définition d'outil lisible par un modèle (assistant IA, connecteur MCP) : rien du contexte n'y figure. */
export type ToolDefinition = {
  name: string;
  /** Texte en clair (traduction anglaise de la clé `description`), pas la clé. */
  description: string;
  /** JSON Schema (draft 2020-12) des paramètres d'entrée, produit par `z.toJSONSchema`. */
  inputSchema: Record<string, unknown>;
};

/** Déclaration d'une action, telle qu'un module l'écrit (src/modules/<module>/actions.ts). */
export type ActionDefinition<P, R> = {
  /** Stable, `<module>.<verbe>` (ex. `core.setLocale`) : c'est ce nom que les canaux appellent. */
  name: string;
  /** Clé de traduction (ADR-007) ; sa traduction anglaise sert de description d'outil pour un modèle. */
  description: string;
  /**
   * Paramètres validés avant `run` ; `z.strictObject` : une clé en trop (userId, workspaceId, origin…) est
   * refusée. Chaque champ porte un `.describe()` en anglais (unités, formats) : il devient la description
   * du champ dans le JSON Schema de l'outil.
   */
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
