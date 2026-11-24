import { DatabaseError, sqlStateOf } from "./database-error";

// Messages exacts du pilote pg embarqué dans @neondatabase/serverless 1.2.0 (index.mjs, Client) :
// - fermeture du flux (« end ») : « Connection terminated unexpectedly », ou « Connection terminated » si le client
//   était en train de se fermer (veille Neon : le premier, sans SQLSTATE, BEMYBRAIN-3) ;
// - requête sur un client fermé ou devenu non requêtable après une erreur de connexion.
// Comparaison exacte : un message libre (« terminated », « timeout ») ne suffit pas. « Connection terminated due
// to connection timeout » (délai de connexion de pg-pool, non configuré ici) n'en fait pas partie.
const DRIVER_MESSAGES = new Set([
  "Connection terminated unexpectedly",
  "Connection terminated",
  "Client was closed and is not queryable",
  "Client has encountered a connection error and is not queryable",
]);

// Classe 08 (connection exception) ; 57P01 admin_shutdown (pg_terminate_backend), 57P02 crash_shutdown,
// 57P03 cannot_connect_now (serveur qui démarre). 08P01 (protocol_violation) peut aussi venir d'une requête mal
// liée : sans conséquence, seules les étapes d'avant la fonction métier (requêtes fixes) sont rejouées, une fois.
const CONNECTION_SQLSTATE = /^(?:08[0-9A-Z]{3}|57P0[123])$/;

// Codes système d'un socket coupé. Pas d'ETIMEDOUT : un délai ne dit pas que la connexion est perdue.
const SOCKET_CODES = new Set(["ECONNRESET", "EPIPE"]);

function hasDriverMessage(error: unknown): boolean {
  return error instanceof Error && DRIVER_MESSAGES.has(error.message);
}

function hasSocketCode(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && SOCKET_CODES.has(code);
}

/**
 * Erreur du WebSocket de Neon (index.mjs, configureWebSocket : `ws.addEventListener("error", f => emit("error", f))`).
 * Le pilote la relaie telle quelle (reportStreamError → _handleErrorEvent → _errorAllQueries, ou rejet de
 * connect()) : la requête ou l'emprunt rejette avec l'objet `ErrorEvent` du WebSocket global de Node (undici),
 * pas une Error : `instanceof Event`, `type === "error"`, `error` = TypeError. Drizzle le met en `cause`.
 */
function isWebSocketError(value: unknown): boolean {
  return (
    typeof Event !== "undefined" &&
    value instanceof Event &&
    value.type === "error"
  );
}

/**
 * Vrai si l'erreur (ou sa cause directe, Drizzle enveloppe l'erreur du pilote) signale une connexion perdue :
 * connexion fermée ou coupée côté client (message exact du pilote, ECONNRESET / EPIPE, erreur du WebSocket),
 * ou SQLSTATE de connexion. Faux pour tout le reste, dont une
 * DatabaseError déjà masquée : elle a quitté la transaction, il est trop tard pour la rejouer.
 */
export function isConnectionLost(error: unknown): boolean {
  if (isWebSocketError(error)) return true;
  if (!(error instanceof Error) || error instanceof DatabaseError) return false;
  const code = sqlStateOf(error);
  if (code !== undefined && CONNECTION_SQLSTATE.test(code)) return true;
  if (isWebSocketError(error.cause)) return true;
  return [error, error.cause].some(
    (candidate) => hasDriverMessage(candidate) || hasSocketCode(candidate),
  );
}
