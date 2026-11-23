import { Pool, type PoolClient } from "@neondatabase/serverless";

/**
 * Pool du pilote Neon, avec journalisation générique des erreurs de connexion.
 * `role` ne sert qu'au message : ni URL, ni claims, ni détail de l'erreur du pilote.
 */
export function createPool(connectionString: string, role: string): Pool {
  const pool = new Pool({ connectionString });
  const log = () => {
    console.error(`Erreur sur une connexion du pool ${role}.`);
  };
  // pg-pool retire son écouteur d'erreur de repos quand une transaction emprunte la connexion : un socket
  // coupé pendant une lecture émettrait alors « error » sans écouteur (uncaughtException, processus tué).
  // Écouteur permanent sur chaque connexion : la requête en cours échoue normalement, et la connexion,
  // devenue non requêtable, est retirée du pool à son rendu (QA-4, Sentry BEMYBRAIN-5).
  // Effet de bord : écouter « connect » passe hasFetchUnsupportedListeners à vrai dans le Pool de Neon, ce qui
  // désactive neonConfig.poolQueryViaFetch (non utilisé aujourd'hui).
  pool.on("connect", (client: PoolClient) => {
    client.on("error", log);
  });
  // Erreur d'une connexion au repos : déjà journalisée par l'écouteur ci-dessus. Écouteur requis :
  // sans lui, le pool émettrait « error » sans écouteur.
  pool.on("error", () => undefined);
  return pool;
}
